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
  });

  function onDone(evt){
    var form = evt.target.closest('form');
    disableForm(form, false);
  }

  document.addEventListener('htmx:afterRequest', onDone);
  document.addEventListener('htmx:responseError', onDone);
  document.addEventListener('htmx:sendError', onDone);
})();

