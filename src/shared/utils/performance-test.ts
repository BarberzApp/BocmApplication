// Performance testing utilities for the barber app

import { logger } from '../lib/logger'

export interface PerformanceMetrics {
  loadTime: number
  firstContentfulPaint: number
  largestContentfulPaint: number
  timeToInteractive: number
  totalBlockingTime: number
  cumulativeLayoutShift: number
}

export interface ComponentPerformanceMetrics {
  renderTime: number
  memoryUsage: number
  reRenderCount: number
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = []
  private observers: PerformanceObserver[] = []

  constructor() {
    this.setupObservers()
  }

  private setupObservers() {
    // Observe paint timing
    if ('PerformanceObserver' in window) {
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.recordMetric('firstContentfulPaint', entry.startTime)
          }
        }
      })
      paintObserver.observe({ entryTypes: ['paint'] })

      // Observe largest contentful paint
      const lcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('largestContentfulPaint', entry.startTime)
        }
      })
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

      // Observe layout shifts
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0
        for (const entry of list.getEntries()) {
          const layoutShiftEntry = entry as any
          if (!layoutShiftEntry.hadRecentInput) {
            clsValue += layoutShiftEntry.value
          }
        }
        this.recordMetric('cumulativeLayoutShift', clsValue)
      })
      clsObserver.observe({ entryTypes: ['layout-shift'] })

      this.observers.push(paintObserver, lcpObserver, clsObserver)
    }
  }

  private recordMetric(key: keyof PerformanceMetrics, value: number) {
    const metric = this.metrics[this.metrics.length - 1] || this.createEmptyMetrics()
    metric[key] = value
  }

  private createEmptyMetrics(): PerformanceMetrics {
    return {
      loadTime: 0,
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
      timeToInteractive: 0,
      totalBlockingTime: 0,
      cumulativeLayoutShift: 0,
    }
  }

  startMeasurement() {
    this.metrics.push(this.createEmptyMetrics())
    performance.mark('app-start')
  }

  endMeasurement() {
    performance.mark('app-end')
    performance.measure('app-load', 'app-start', 'app-end')
    
    const measure = performance.getEntriesByName('app-load')[0]
    if (measure) {
      this.recordMetric('loadTime', measure.duration)
    }

    // Calculate Time to Interactive (simplified)
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    if (navigationEntry) {
      const tti = navigationEntry.domContentLoadedEventEnd - navigationEntry.fetchStart
      this.recordMetric('timeToInteractive', tti)
    }
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics]
  }

  getLatestMetrics(): PerformanceMetrics | null {
    return this.metrics[this.metrics.length - 1] || null
  }

  cleanup() {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
  }
}

export class ComponentPerformanceMonitor {
  private renderTimes: Map<string, number[]> = new Map()
  private memoryUsage: Map<string, number[]> = new Map()
  private reRenderCounts: Map<string, number> = new Map()

  startComponentRender(componentName: string) {
    performance.mark(`${componentName}-render-start`)
  }

  endComponentRender(componentName: string) {
    performance.mark(`${componentName}-render-end`)
    performance.measure(`${componentName}-render`, `${componentName}-render-start`, `${componentName}-render-end`)
    
    const measure = performance.getEntriesByName(`${componentName}-render`)[0]
    if (measure) {
      const times = this.renderTimes.get(componentName) || []
      times.push(measure.duration)
      this.renderTimes.set(componentName, times)
    }

    // Track re-render count
    const currentCount = this.reRenderCounts.get(componentName) || 0
    this.reRenderCounts.set(componentName, currentCount + 1)

    // Track memory usage (if available)
    if ('memory' in performance) {
      const memory = (performance as any).memory
      const memoryUsage = memory.usedJSHeapSize
      const usages = this.memoryUsage.get(componentName) || []
      usages.push(memoryUsage)
      this.memoryUsage.set(componentName, usages)
    }
  }

  getComponentMetrics(componentName: string): ComponentPerformanceMetrics | null {
    const renderTimes = this.renderTimes.get(componentName)
    const memoryUsages = this.memoryUsage.get(componentName)
    const reRenderCount = this.reRenderCounts.get(componentName) || 0

    if (!renderTimes) return null

    return {
      renderTime: renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
      memoryUsage: memoryUsages ? memoryUsages[memoryUsages.length - 1] : 0,
      reRenderCount,
    }
  }

  getAllComponentMetrics(): Record<string, ComponentPerformanceMetrics> {
    const metrics: Record<string, ComponentPerformanceMetrics> = {}
    
    for (const [componentName] of this.renderTimes) {
      const componentMetrics = this.getComponentMetrics(componentName)
      if (componentMetrics) {
        metrics[componentName] = componentMetrics
      }
    }

    return metrics
  }

  reset() {
    this.renderTimes.clear()
    this.memoryUsage.clear()
    this.reRenderCounts.clear()
  }
}

// Utility functions for performance testing
export const measureAsyncOperation = async <T>(
  operation: () => Promise<T>,
  operationName: string = 'async-operation'
): Promise<{ result: T; duration: number }> => {
  const start = performance.now()
  const result = await operation()
  const duration = performance.now() - start
  
  logger.debug(`${operationName} took ${duration.toFixed(2)}ms`)
  return { result, duration }
}

export const measureSyncOperation = <T>(
  operation: () => T,
  operationName: string = 'sync-operation'
): { result: T; duration: number } => {
  const start = performance.now()
  const result = operation()
  const duration = performance.now() - start
  
  logger.debug(`${operationName} took ${duration.toFixed(2)}ms`)
  return { result, duration }
}

export const createPerformanceTest = (testName: string) => {
  const monitor = new PerformanceMonitor()
  const componentMonitor = new ComponentPerformanceMonitor()

  return {
    start: () => {
      logger.debug(`Starting performance test: ${testName}`)
      monitor.startMeasurement()
    },
    end: () => {
      monitor.endMeasurement()
      const metrics = monitor.getLatestMetrics()
      const componentMetrics = componentMonitor.getAllComponentMetrics()
      
      logger.debug(`Performance test results for: ${testName}`, { metrics, componentMetrics })
      
      return { metrics, componentMetrics }
    },
    measureComponent: (componentName: string) => ({
      start: () => componentMonitor.startComponentRender(componentName),
      end: () => componentMonitor.endComponentRender(componentName),
    }),
    cleanup: () => {
      monitor.cleanup()
      componentMonitor.reset()
    },
  }
}

// Performance thresholds for testing
export const PERFORMANCE_THRESHOLDS = {
  loadTime: 3000, // 3 seconds
  firstContentfulPaint: 1500, // 1.5 seconds
  largestContentfulPaint: 2500, // 2.5 seconds
  timeToInteractive: 3500, // 3.5 seconds
  componentRenderTime: 16, // 16ms (60fps)
  memoryUsage: 50 * 1024 * 1024, // 50MB
} as const

export const checkPerformanceThresholds = (metrics: PerformanceMetrics): string[] => {
  const violations: string[] = []

  if (metrics.loadTime > PERFORMANCE_THRESHOLDS.loadTime) {
    violations.push(`Load time (${metrics.loadTime}ms) exceeds threshold (${PERFORMANCE_THRESHOLDS.loadTime}ms)`)
  }

  if (metrics.firstContentfulPaint > PERFORMANCE_THRESHOLDS.firstContentfulPaint) {
    violations.push(`First Contentful Paint (${metrics.firstContentfulPaint}ms) exceeds threshold (${PERFORMANCE_THRESHOLDS.firstContentfulPaint}ms)`)
  }

  if (metrics.largestContentfulPaint > PERFORMANCE_THRESHOLDS.largestContentfulPaint) {
    violations.push(`Largest Contentful Paint (${metrics.largestContentfulPaint}ms) exceeds threshold (${PERFORMANCE_THRESHOLDS.largestContentfulPaint}ms)`)
  }

  if (metrics.timeToInteractive > PERFORMANCE_THRESHOLDS.timeToInteractive) {
    violations.push(`Time to Interactive (${metrics.timeToInteractive}ms) exceeds threshold (${PERFORMANCE_THRESHOLDS.timeToInteractive}ms)`)
  }

  return violations
}
