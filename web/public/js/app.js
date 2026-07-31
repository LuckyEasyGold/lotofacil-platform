// Main App JavaScript
// Global utilities for the Lotofácil Platform

document.addEventListener('DOMContentLoaded', () => {
  // Close sidebar on outside click (mobile)
  document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.querySelector('.menu-toggle');
    if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
      if (!sidebar.contains(e.target) && !toggle?.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    }
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    const profile = document.querySelector('.user-profile');
    if (profile?.classList.contains('open') && !profile.contains(e.target)) {
      profile.classList.remove('open');
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('modalOverlay');
      if (modal?.classList.contains('visible')) closeModal();
    }
  });
});



// Add smooth page load
window.addEventListener('pageshow', () => {
  const content = document.querySelector('.page-content');
  if (content) {
    content.style.opacity = '0';
    content.style.transform = 'translateY(10px)';
    requestAnimationFrame(() => {
      content.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      content.style.opacity = '1';
      content.style.transform = 'translateY(0)';
    });
  }
});
