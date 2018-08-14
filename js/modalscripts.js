// Map Modal Settings
$(document).ready(function () {
  function toggle() {
    $('#fullscreen-background').toggleClass('fullscreen-background');
    $('#map').toggleClass('fullscreen')
    $('#map_hide').toggleClass('hide');

  }

  $('#fullscreen').on('click', toggle);
  $('#fullscreen-background').on('click', function(e) {
    if (e.target == this) {
      toggle()
    }
  });

})


//Contact Modal
$(document).ready(function () {
  var contact_modal = document.getElementById('contact_modal_screened');
  var btn = document.getElementById('contact_btn');
  var close_btn = document.getElementById('contact_close');

  btn.onclick = function() {
    contact_modal.style.display = "block";
  }

  close_btn.onclick = function() {
    contact_modal.style.display = "none";
  }

});

//Fixed Nav Bar
$(document).ready(function () {
  $(window).bind('scroll', function () {
    var vPos = $(window).scrollTop();
    var totalH = $('.top-section').offset().top;
    var finalSize = totalH - vPos;

    //console.log('nav offset', totalH)
    //console.log(finalSize);

    if (finalSize <= -10) {
      $('#stickyNav').css({
        'position': 'fixed',
        'top': 50
      });

      $('.stickyNav-title').attr('id', 'show-title');
      $('.stickyNav-img').attr('id', 'show-img');
      $('.stickyNav-menu-center').attr('id', 'hide-menu');
      $('.top-sticky-nav-desktop').attr('id', 'show-nav');
      $('.side-nav-bar').removeAttr('id');


    } else {

      $('#stickyNav').css({
        'position': 'relative'
      });
      $('.stickyNav-title').removeAttr('id');
      $('.stickyNav-img').removeAttr('id');
      $('.stickyNav-menu-center').removeAttr('id');
      $('.top-sticky-nav-desktop').removeAttr('id');
      $('.side-nav-bar').attr('id', 'hide-menu');

    }
  });
});

//Fire mobile Nav Bar
$(document).ready(function() {
  $('.stickyNavList-btn').on('click', function() {
    $('.stickyNav').toggle();
  });
});
