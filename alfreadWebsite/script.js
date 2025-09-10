// Alfred Website JavaScript

document.addEventListener('DOMContentLoaded', function() {
  // Initialize variables
  const header = document.querySelector('.header');
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const navLinks = document.querySelector('.nav-links');
  const scrollLinks = document.querySelectorAll('a[href^="#"]');
  
  // Theme toggle functionality removed as requested
  
  // Header scroll effect
  window.addEventListener('scroll', function() {
    if (window.scrollY > 50) {
      header.classList.add('header-scrolled');
    } else {
      header.classList.remove('header-scrolled');
    }
  });
  
  // Mobile menu toggle
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', function() {
      navLinks.classList.toggle('active');
      mobileMenuBtn.classList.toggle('active');
    });
  }
  
  // Smooth scrolling for anchor links
  scrollLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Close mobile menu if open
      if (navLinks.classList.contains('active')) {
        navLinks.classList.remove('active');
        mobileMenuBtn.classList.remove('active');
      }
      
      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      
      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop - 80, // Adjust for header height
          behavior: 'smooth'
        });
      }
    });
  });
  
  // Animation on scroll
  const animateElements = document.querySelectorAll('.animate, .feature-card, .use-case-item, .step');
  
  function checkIfInView() {
    const windowHeight = window.innerHeight;
    const windowTopPosition = window.scrollY;
    const windowBottomPosition = windowTopPosition + windowHeight;
    
    animateElements.forEach((element, index) => {
      const elementHeight = element.offsetHeight;
      const elementTopPosition = element.offsetTop;
      const elementBottomPosition = elementTopPosition + elementHeight;
      
      // Check if element is in viewport
      if (
        (elementBottomPosition >= windowTopPosition) &&
        (elementTopPosition <= windowBottomPosition)
      ) {
        // Add staggered delay for smoother animation sequence
        setTimeout(() => {
          element.classList.add('animated');
        }, index * 100); // 100ms delay between each element
      }
    });
  }
  
  // Run on page load
  setTimeout(checkIfInView, 300); // Small delay to ensure DOM is fully ready
  
  // Run on scroll
  window.addEventListener('scroll', checkIfInView);
  
  // YouTube video placeholder
  const videoPlaceholder = document.querySelector('.video-placeholder');
  if (videoPlaceholder) {
    videoPlaceholder.addEventListener('click', function() {
      const videoId = this.getAttribute('data-video-id');
      if (videoId) {
        const iframe = document.createElement('iframe');
        iframe.setAttribute('src', `https://www.youtube.com/embed/${videoId}?autoplay=1`);
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
        iframe.setAttribute('allowfullscreen', '');
        
        this.parentNode.replaceChild(iframe, this);
      }
    });
  }
  
  // Testimonial carousel (if needed)
  const testimonialCards = document.querySelectorAll('.testimonial-card');
  let currentTestimonial = 0;
  
  function showTestimonial(index) {
    testimonialCards.forEach((card, i) => {
      if (i === index) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  }
  
  // Initialize testimonials if they exist and are more than 3
  if (testimonialCards.length > 3) {
    // Show only the first testimonial on mobile
    if (window.innerWidth < 768) {
      showTestimonial(currentTestimonial);
      
      // Add navigation buttons
      const prevBtn = document.createElement('button');
      prevBtn.classList.add('testimonial-nav', 'prev');
      prevBtn.innerHTML = '&larr;';
      
      const nextBtn = document.createElement('button');
      nextBtn.classList.add('testimonial-nav', 'next');
      nextBtn.innerHTML = '&rarr;';
      
      const testimonialContainer = document.querySelector('.testimonials-grid');
      const navContainer = document.createElement('div');
      navContainer.classList.add('testimonial-nav-container');
      
      navContainer.appendChild(prevBtn);
      navContainer.appendChild(nextBtn);
      testimonialContainer.parentNode.insertBefore(navContainer, testimonialContainer.nextSibling);
      
      // Add event listeners
      prevBtn.addEventListener('click', function() {
        currentTestimonial = (currentTestimonial - 1 + testimonialCards.length) % testimonialCards.length;
        showTestimonial(currentTestimonial);
      });
      
      nextBtn.addEventListener('click', function() {
        currentTestimonial = (currentTestimonial + 1) % testimonialCards.length;
        showTestimonial(currentTestimonial);
      });
    }
  }
  
  // Visual effects removed for cleaner design
  
  // Chrome Web Store download button tracking
  const downloadBtn = document.querySelector('.download-btn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', function() {
      // Track download click (can be replaced with actual analytics code)
      console.log('Download button clicked');
      
      // You can add Google Analytics event tracking here
      // if (typeof gtag === 'function') {
      //   gtag('event', 'click', {
      //     'event_category': 'download',
      //     'event_label': 'chrome_store'
      //   });
      // }
    });
  }
});