import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { supabase } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'

interface Service {
  id?: string
  name: string
  duration: number // in minutes
  price: number
}

interface ServiceFormData {
  name: string
  duration: number
  price: number
}

export function ServicesSettings() {
  const [services, setServices] = useState<Service[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ServiceFormData>()

  // Load existing services
  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('name')

      if (error) throw error
      if (data) setServices(data)
    } catch (error) {
      logger.error('Error loading services', error)
    }
  }

  // Add new service
  const onSubmit = async (data: ServiceFormData) => {
    try {
      setIsLoading(true)
      const { error } = await supabase
        .from('services')
        .insert([data])

      if (error) throw error
      
      await loadServices()
      reset()
    } catch (error) {
      logger.error('Error adding service', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Delete service
  const deleteService = async (id: string) => {
    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      await loadServices()
    } catch (error) {
      logger.error('Error deleting service', error)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">Services</h3>
        <p className="mt-1 text-sm text-gray-500">Manage your services and pricing.</p>
      </div>

      {/* Add Service Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Service Name
            </label>
            <input
              type="text"
              id="name"
              {...register('name', { required: 'Service name is required' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700">
              Duration (minutes)
            </label>
            <input
              type="number"
              id="duration"
              min="1"
              {...register('duration', { 
                required: 'Duration is required',
                min: { value: 1, message: 'Duration must be at least 1 minute' }
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            {errors.duration && (
              <p className="mt-1 text-sm text-red-600">{errors.duration.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700">
              Price ($)
            </label>
            <input
              type="number"
              id="price"
              min="0"
              step="0.01"
              {...register('price', { 
                required: 'Price is required',
                min: { value: 0, message: 'Price must be at least $0' }
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            {errors.price && (
              <p className="mt-1 text-sm text-red-600">{errors.price.message}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isLoading ? 'Adding...' : 'Add Service'}
          </button>
        </div>
      </form>

      {/* Services List */}
      <div className="mt-8">
        <h4 className="text-sm font-medium text-gray-900">Your Services</h4>
        <div className="mt-4 divide-y divide-gray-200">
          {services.map((service) => (
            <div key={service.id} className="py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{service.name}</p>
                <p className="text-sm text-gray-500">
                  {service.duration} minutes • ${service.price.toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => service.id && deleteService(service.id)}
                className="text-sm text-red-600 hover:text-red-900"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 