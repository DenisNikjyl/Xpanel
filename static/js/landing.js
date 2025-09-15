// Landing Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Mobile Navigation
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }
    
    // Smooth Scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Navbar Background on Scroll
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
    
    // Counter Animation
    const counters = document.querySelectorAll('.stat-number');
    const animateCounters = () => {
        counters.forEach(counter => {
            const target = parseInt(counter.textContent.replace(/[^\d]/g, ''));
            const increment = target / 100;
            let current = 0;
            
            const updateCounter = () => {
                if (current < target) {
                    current += increment;
                    if (counter.textContent.includes('%')) {
                        counter.textContent = Math.ceil(current) + '%';
                    } else if (counter.textContent.includes('+')) {
                        counter.textContent = Math.ceil(current).toLocaleString() + '+';
                    } else if (counter.textContent.includes('/')) {
                        counter.textContent = Math.ceil(current * 10) / 10 + '/7';
                    } else {
                        counter.textContent = Math.ceil(current).toLocaleString();
                    }
                    requestAnimationFrame(updateCounter);
                }
            };
            
            updateCounter();
        });
    };
    
    // Intersection Observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
                
                // Animate counters when about section is visible
                if (entry.target.classList.contains('about-stats')) {
                    animateCounters();
                }
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    document.querySelectorAll('.feature-card, .pricing-card, .about-stats').forEach(el => {
        observer.observe(el);
    });
    
    // Typing Animation for Hero - DISABLED to prevent HTML tag issues
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
        // Keep original HTML content intact
        // const text = heroTitle.innerHTML;
        // heroTitle.innerHTML = '';
        
        // let i = 0;
        // const typeWriter = () => {
        //     if (i < text.length) {
        //         heroTitle.innerHTML += text.charAt(i);
        //         i++;
        //         setTimeout(typeWriter, 50);
        //     }
        // };
        
        // setTimeout(typeWriter, 500);
    }
    
    // Global switchLanguage function
    window.switchLanguage = function(lang) {
        if (lang === 'ru') {
            window.location.href = '/ru';
        } else {
            window.location.href = '/';
        }
    };
    
    // Parallax Effect
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const parallaxElements = document.querySelectorAll('.floating-element');
        
        parallaxElements.forEach((element, index) => {
            const speed = 0.5 + (index * 0.2);
            element.style.transform = `translateY(${scrolled * speed}px)`;
        });
    });
    
    // Dashboard Preview Interactions
    const dashboardPreview = document.querySelector('.dashboard-preview');
    if (dashboardPreview) {
        // Animate stats on hover
        dashboardPreview.addEventListener('mouseenter', () => {
            const statValues = dashboardPreview.querySelectorAll('.stat-value');
            statValues.forEach(stat => {
                const originalValue = stat.textContent;
                const randomValue = Math.floor(Math.random() * 100);
                
                if (originalValue.includes('%')) {
                    stat.textContent = randomValue + '%';
                } else if (originalValue.includes('GB')) {
                    stat.textContent = (Math.random() * 4).toFixed(1) + 'GB';
                }
                
                setTimeout(() => {
                    stat.textContent = originalValue;
                }, 2000);
            });
        });
        
        // Terminal typing effect
        const terminalBody = dashboardPreview.querySelector('.terminal-body');
        if (terminalBody) {
            const commands = [
                { prompt: '$', command: 'htop', output: 'Tasks: 156 total, 2 running, 154 sleeping' },
                { prompt: '$', command: 'df -h', output: '/dev/sda1    20G   13G  6.2G  68% /' },
                { prompt: '$', command: 'uptime', output: 'up 15 days, 3:42, 2 users, load: 0.45' }
            ];
            
            let currentCommand = 0;
            
            setInterval(() => {
                if (currentCommand < commands.length) {
                    const cmd = commands[currentCommand];
                    const newLine = document.createElement('div');
                    newLine.className = 'terminal-line';
                    newLine.innerHTML = `
                        <span class="prompt">${cmd.prompt}</span>
                        <span class="command">${cmd.command}</span>
                    `;
                    
                    terminalBody.appendChild(newLine);
                    
                    setTimeout(() => {
                        const outputLine = document.createElement('div');
                        outputLine.className = 'terminal-line';
                        outputLine.innerHTML = `<span class="output">${cmd.output}</span>`;
                        terminalBody.appendChild(outputLine);
                        
                        // Keep only last 6 lines
                        while (terminalBody.children.length > 6) {
                            terminalBody.removeChild(terminalBody.firstChild);
                        }
                    }, 1000);
                    
                    currentCommand = (currentCommand + 1) % commands.length;
                }
            }, 5000);
        }
    }
    
    // Pricing Card Interactions
    const pricingCards = document.querySelectorAll('.pricing-card');
    pricingCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = card.classList.contains('featured') 
                ? 'scale(1.05) translateY(-10px)' 
                : 'translateY(-10px)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = card.classList.contains('featured') 
                ? 'scale(1.05)' 
                : 'translateY(0)';
        });
    });
    
    // Feature Card Hover Effects
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            const icon = card.querySelector('.feature-icon');
            icon.style.transform = 'scale(1.1) rotate(5deg)';
        });
        
        card.addEventListener('mouseleave', () => {
            const icon = card.querySelector('.feature-icon');
            icon.style.transform = 'scale(1) rotate(0deg)';
        });
    });
    
    // Tech Stack Animation
    const techItems = document.querySelectorAll('.tech-item');
    techItems.forEach((item, index) => {
        item.style.animationDelay = `${index * 0.1}s`;
        
        item.addEventListener('mouseenter', () => {
            item.style.transform = 'translateY(-5px) scale(1.05)';
        });
        
        item.addEventListener('mouseleave', () => {
            item.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // Button Ripple Effect
    const buttons = document.querySelectorAll('.btn, .plan-button');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
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
});

// Add CSS for ripple effect
const style = document.createElement('style');
style.textContent = `
    .btn, .plan-button {
        position: relative;
        overflow: hidden;
    }
    
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
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
    
    .navbar.scrolled {
        background: rgba(255, 255, 255, 0.98);
        box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
    }
    
    .feature-card.animate {
        animation: slideInUp 0.6s ease-out;
    }
    
    .pricing-card.animate {
        animation: slideInUp 0.6s ease-out;
    }
    
    @keyframes slideInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
            display: flex;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            flex-direction: column;
            padding: 1rem;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            border-top: 1px solid var(--border-color);
        }
        
        .hamburger.active span:nth-child(1) {
            transform: rotate(-45deg) translate(-5px, 6px);
        }
        
        .hamburger.active span:nth-child(2) {
            opacity: 0;
        }
        
        .hamburger.active span:nth-child(3) {
            transform: rotate(45deg) translate(-5px, -6px);
        }
    }
`;
document.head.appendChild(style);
