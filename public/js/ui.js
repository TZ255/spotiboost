// HTMX form UX: disable fields and show spinner during requests
(function(){
  function disableForm(form, disabled) {
    if (!form) return;
    var fields = form.querySelectorAll('input, select, textarea, button');
    fields.forEach(function(el){ el.disabled = !!disabled; });
    var spinner = form.querySelector('[data-spinner]');
    if (spinner) spinner.classList.toggle('d-none', !disabled);
  }

  document.addEventListener('htmx:beforeRequest', function (evt) {
    var form = evt.target.closest('form');
    disableForm(form, true);
    // Open/reset modal if requested
    try {
      var modalId = form && form.getAttribute('data-open-modal');
      if (modalId && window.bootstrap) {
        var el = document.getElementById(modalId);
        if (el) {
          var modal = window.bootstrap.Modal.getOrCreateInstance(el, { backdrop: 'static', keyboard: false });
          modal.show();
          var title = document.getElementById('paymentModalTitle');
          var body = document.getElementById('paymentModalBody');
          var footer = document.getElementById('paymentModalFooter');
          if (title) title.textContent = 'Malipo Tanzania 🇹🇿';
          if (body) body.innerHTML = '<div class="d-flex justify-content-center align-items-center"><div class="spinner-border text-dark mx-auto" role="status" style="height: 3rem; width: 3rem;"><span class="visually-hidden">Loading...</span></div></div>';
          if (footer) footer.innerHTML = '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal"><i class="fa-regular fa-circle-xmark me-1"></i> Funga</button>';
        }
      }
    } catch (e) {}
  });

  function onDone(evt){
    var form = evt.target.closest('form');
    disableForm(form, false);
  }

  document.addEventListener('htmx:afterRequest', onDone);
  document.addEventListener('htmx:responseError', onDone);
  document.addEventListener('htmx:sendError', onDone);
})();

// Keep client JS minimal: rely on HTML5 validation & HTMX; modal reset handled above.
