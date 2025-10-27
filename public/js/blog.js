
document.addEventListener('DOMContentLoaded', function () {
  const blogPost = document.getElementById('blog-post');
  if (!blogPost) return;

  // Reading progress indicator
  const progressBar = document.createElement('div');
  progressBar.id = 'reading-progress';
  progressBar.style.cssText = [
    'position:fixed','top:0','left:0','width:0%','height:3px',
    'background:linear-gradient(to right,#198754,#146c43)','z-index:1000',
    'transition:width 0.1s ease'
  ].join(';');
  document.body.appendChild(progressBar);

  function updateProgress() {
    const scrollTop = window.pageYOffset;
    const docHeight = Math.max(1, document.body.scrollHeight - window.innerHeight);
    progressBar.style.width = Math.min(100, (scrollTop / docHeight) * 100) + '%';
  }
  window.addEventListener('scroll', updateProgress);
  updateProgress();

  // Smooth scroll for TOC links
  const tocLinks = blogPost.querySelectorAll('#table-of-contents a[href^="#"]');
  tocLinks.forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const targetId = this.getAttribute('href').substring(1);
      const target = document.getElementById(targetId);
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Toggle TOC
  const toggleBtn = document.getElementById('toc-toggle');
  const tocList = document.getElementById('toc-list');
  if (toggleBtn && tocList) {
    toggleBtn.addEventListener('click', () => {
      tocList.classList.toggle('open');
      toggleBtn.textContent = tocList.classList.contains('open') ? '[-]' : '[+]';
      toggleBtn.setAttribute('aria-expanded', tocList.classList.contains('open') ? 'true' : 'false');
    });
  }
});
