here is the js for the beuaty pro page:

// Mobile Navigation Toggle
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('nav-menu');

if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        hamburger.classList.toggle('active');
    });

    // Close mobile menu when clicking on a link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            hamburger.classList.remove('active');
        });
    });
}

// Revenue Calculator - The "Holy Shit" Moment
const currentRevenueInput = document.getElementById('current-revenue');
const projectedRevenueElement = document.getElementById('projected-revenue');
const extraAnnualElement = document.getElementById('extra-annual');

function updateCalculator() {
    const currentRevenue = parseFloat(currentRevenueInput.value) || 5000;
    
    // Calculate 40% increase (conservative estimate)
    const projectedRevenue = Math.round(currentRevenue * 1.4);
    const monthlyIncrease = projectedRevenue - currentRevenue;
    const annualIncrease = monthlyIncrease * 12;
    
    // Animate the numbers
    animateNumber(projectedRevenueElement, projectedRevenue, '$', ',');
    animateNumber(extraAnnualElement, annualIncrease, 'That\'s an extra $', ',', ' per year');
}

function animateNumber(element, targetValue, prefix = '', suffix = '', postfix = '') {
    const startValue = 0;
    const duration = 1000;
    const startTime = performance.now();
    
    function updateNumber(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = Math.round(startValue + (targetValue - startValue) * easeOutQuart);
        
        element.textContent = prefix + formatNumber(currentValue) + suffix + postfix;
        
        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        }
    }
    
    requestAnimationFrame(updateNumber);
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

if (currentRevenueInput) {
    currentRevenueInput.addEventListener('input', updateCalculator);
    // Initialize calculator
    updateCalculator();
}

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offsetTop = target.offsetTop - 80; // Account for fixed navbar
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// Navbar scroll effect
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        if (window.scrollY > 100) {
            navbar.style.background = 'rgba(255, 255, 255, 0.98)';
            navbar.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.1)';
        } else {
            navbar.style.background = 'rgba(255, 255, 255, 0.95)';
            navbar.style.boxShadow = 'none';
        }
    }
});

// Intersection Observer for fade-in animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('fade-in-up');
        }
    });
}, observerOptions);

// Enhanced button click effects with ripple
document.querySelectorAll('.cta-primary, .cta-secondary, .nav-cta, .calculator-cta, .cta-primary-large, .cta-secondary-large').forEach(button => {
    button.addEventListener('click', function(e) {
        // Create ripple effect
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple');
        
        this.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    });
});

// Testimonial cards enhanced hover effects
document.querySelectorAll('.testimonial-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-8px) scale(1.02)';
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0) scale(1)';
    });
});

// Feature items enhanced hover effects
document.querySelectorAll('.feature-item').forEach(item => {
    item.addEventListener('mouseenter', () => {
        const number = item.querySelector('.feature-number');
        if (number) {
            number.style.transform = 'scale(1.1) rotate(5deg)';
        }
    });
    
    item.addEventListener('mouseleave', () => {
        const number = item.querySelector('.feature-number');
        if (number) {
            number.style.transform = 'scale(1) rotate(0deg)';
        }
    });
});

// Loading animation
window.addEventListener('load', () => {
    document.body.classList.add('loaded');
    
    // Animate hero elements with stagger
    setTimeout(() => {
        const heroHeadline = document.querySelector('.hero-headline');
        if (heroHeadline) heroHeadline.classList.add('fade-in-up');
    }, 200);
    
    setTimeout(() => {
        const heroSubtitle = document.querySelector('.hero-subtitle');
        if (heroSubtitle) heroSubtitle.classList.add('fade-in-up');
    }, 400);
    
    setTimeout(() => {
        const heroCtas = document.querySelector('.hero-ctas');
        if (heroCtas) heroCtas.classList.add('fade-in-up');
    }, 600);
});

// Observe elements for animation
document.addEventListener('DOMContentLoaded', () => {
    const animateElements = document.querySelectorAll('.section-headline, .testimonial-card, .feature-item, .calculator-widget');
    animateElements.forEach(el => observer.observe(el));
});

// Enhanced CTA tracking and analytics simulation
function trackCTAClick(ctaType, location) {
    // In a real app, this would send to analytics
    console.log(`CTA Clicked: ${ctaType} at ${location}`);
    
    // Simulate conversion tracking
    if (ctaType === 'primary') {
        // Show success message or redirect to signup
        showConversionModal();
    }
}

function showConversionModal() {
    // Create a simple modal for demo purposes
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 40px;
        border-radius: 20px;
        text-align: center;
        max-width: 400px;
        margin: 20px;
    `;
    
    modalContent.innerHTML = `
        <h3 style="margin-bottom: 20px; color: #2D1B69;">🎉 Ready to Start Growing?</h3>
        <p style="margin-bottom: 30px; color: #4a4a4a;">This is where you'd be redirected to the signup flow. For this demo, we're just showing this message.</p>
        <button onclick="this.closest('.modal').remove()" style="background: #2D1B69; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer;">Close Demo</button>
    `;
    
    modal.className = 'modal';
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Add click tracking to all CTAs
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.cta-primary, .cta-primary-large').forEach(button => {
        button.addEventListener('click', () => {
            trackCTAClick('primary', button.closest('section')?.className || 'unknown');
        });
    });
    
    document.querySelectorAll('.cta-secondary, .cta-secondary-large').forEach(button => {
        button.addEventListener('click', () => {
            trackCTAClick('secondary', button.closest('section')?.className || 'unknown');
        });
    });
    
    document.querySelectorAll('.calculator-cta').forEach(button => {
        button.addEventListener('click', () => {
            trackCTAClick('calculator', 'calculator-section');
        });
    });
});

// Parallax effect for hero section (subtle)
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const hero = document.querySelector('.hero');
    const heroVisual = document.querySelector('.hero-visual');
    
    if (hero && heroVisual && window.innerWidth > 768) {
        const rate = scrolled * -0.2;
        heroVisual.style.transform = `translateY(${rate}px)`;
    }
});

// Revenue input formatting
if (currentRevenueInput) {
    currentRevenueInput.addEventListener('input', function(e) {
        // Remove non-numeric characters
        let value = e.target.value.replace(/[^\d]/g, '');
        
        // Limit to reasonable values
        if (value > 100000) value = 100000;
        
        // Update the input
        e.target.value = value;
        
        // Update calculator
        updateCalculator();
    });
    
    // Format on blur
    currentRevenueInput.addEventListener('blur', function(e) {
        const value = parseInt(e.target.value) || 5000;
        e.target.value = value.toLocaleString();
    });
    
    // Clear formatting on focus
    currentRevenueInput.addEventListener('focus', function(e) {
        const value = e.target.value.replace(/[^\d]/g, '');
        e.target.value = value;
    });
}

// Add dynamic styles for animations and effects
const dynamicStyles = document.createElement('style');
dynamicStyles.textContent = `
    .cta-primary, .cta-secondary, .nav-cta, .calculator-cta, .cta-primary-large, .cta-secondary-large {
        position: relative;
        overflow: hidden;
    }
    
    .ripple {
        position: absolute;
        border-radius: 50%;
        background-color: rgba(255, 255, 255, 0.4);
        transform: scale(0);
        animation: ripple-animation 0.6s linear;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    .feature-number {
        transition: transform 0.3s ease;
    }
    
    .testimonial-card {
        transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    
    @media (max-width: 768px) {
        .nav-menu {
            display: none;
        }
        
        .nav-menu.active {
            display: flex;
        }
    }
`;
document.head.appendChild(dynamicStyles);

// Performance monitoring (for demo purposes)
window.addEventListener('load', () => {
    const loadTime = performance.now();
    console.log(`Page loaded in ${Math.round(loadTime)}ms`);
    
    // Simulate conversion rate tracking
    const conversionData = {
        pageViews: 1,
        calculatorInteractions: 0,
        ctaClicks: 0,
        timeOnPage: 0
    };
    
    // Track calculator interactions
    if (currentRevenueInput) {
        currentRevenueInput.addEventListener('input', () => {
            conversionData.calculatorInteractions++;
        });
    }
    
    // Track time on page
    setInterval(() => {
        conversionData.timeOnPage += 1;
    }, 1000);
    
    // Log conversion data (in real app, send to analytics)
    window.addEventListener('beforeunload', () => {
        console.log('Conversion Data:', conversionData);
    });
});

console.log('BeautyPro 2025 - Cluely-inspired layout loaded! 🚀');
