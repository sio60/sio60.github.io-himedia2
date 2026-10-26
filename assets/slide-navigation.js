(() => {
      'use strict';
      const slider = document.querySelector('.slider');
      const slides = [...document.querySelectorAll('.slide')];
      const links = [...document.querySelectorAll('[data-go]')];
      const prev = document.querySelector('.prev');
      const next = document.querySelector('.next');
      const dialog = document.querySelector('#consult-dialog');
      const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
      let current = 0;
      let frame = 0;
      let wheelLock = 0;
      let drag = null;
      let suppressClick = false;
      let resizeFrame = 0;

      function sync(index, updateHash = true) {
        index = Math.max(0, Math.min(slides.length - 1, index));
        const changed = index !== current;
        current = index;
        slides.forEach((slide, i) => {
          const active = i === index;
          slide.dataset.active = String(active);
          slide.inert = !active;
        });
        links.forEach(link => {
          const active = Number(link.dataset.go) === index;
          link.classList.toggle('active', active);
          if (active) link.setAttribute('aria-current', 'step');
          else link.removeAttribute('aria-current');
        });
        document.body.dataset.theme = slides[index].dataset.theme;
        if (document.documentElement.hasAttribute('data-sync-theme')) document.documentElement.dataset.theme = slides[index].dataset.theme;
        const chapterSelect = document.querySelector('#chapter-select');
        if (chapterSelect) chapterSelect.value = String(index);
        document.querySelector('#current-page').textContent = String(index + 1).padStart(2, '0');
        document.querySelector('#page-title').textContent = slides[index].dataset.title;
        document.querySelector('#progress-bar').style.width = `${(index + 1) / slides.length * 100}%`;
        prev.disabled = index === 0;
        next.disabled = index === slides.length - 1;
        if (changed) document.querySelector('#slide-status').textContent = `${index + 1} / ${slides.length}. ${slides[index].dataset.title}`;
        if (updateHash && location.hash !== `#${slides[index].id}`) {
          try { history.replaceState(null, '', `#${slides[index].id}`); } catch (_) { /* Local previews may limit history. */ }
        }
      }

      function go(index, immediate = false) {
        const target = Math.max(0, Math.min(slides.length - 1, index));
        slider.scrollTo({ left: target * slider.clientWidth, behavior: immediate || reduceMotion.matches ? 'instant' : 'smooth' });
        if (immediate) sync(target);
      }

      links.forEach(link => link.addEventListener('click', () => go(Number(link.dataset.go))));
      prev.addEventListener('click', () => go(current - 1));
      next.addEventListener('click', () => go(current + 1));
      slider.addEventListener('scroll', () => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          sync(Math.round(slider.scrollLeft / slider.clientWidth));
          frame = 0;
        });
      }, { passive: true });

      document.addEventListener('keydown', event => {
        if (dialog?.open || event.altKey || event.ctrlKey || event.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return;
        const destinations = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: slides.length - 1 };
        if (!(event.key in destinations)) return;
        event.preventDefault();
        go(destinations[event.key]);
      });

      // Vertical wheel works as a page turn on desktop; tall slides retain vertical scrolling.
      slider.addEventListener('wheel', event => {
        if (event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || matchMedia('(pointer: coarse)').matches) return;
        const slide = slides[current];
        const canScroll = slide.scrollHeight > slide.clientHeight + 2;
        if (canScroll) return;
        if (Math.abs(event.deltaY) < 8) return;
        event.preventDefault();
        const now = performance.now();
        if (now < wheelLock) return;
        wheelLock = now + 750;
        go(current + Math.sign(event.deltaY));
      }, { passive: false });

      // Touch uses native scroll snapping; mouse users can also drag the cards.
      slider.addEventListener('pointerdown', event => {
        if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('button,a,input,select,textarea,summary,.table-wrap,.road-scroll')) return;
        drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, left: slider.scrollLeft, index: current, moved: false };
        suppressClick = false;
      });
      slider.addEventListener('pointermove', event => {
        if (!drag || event.pointerId !== drag.id) return;
        const dx = event.clientX - drag.startX;
        if (!drag.moved) {
          if (Math.abs(event.clientY - drag.startY) > Math.abs(dx) + 8) { drag = null; return; }
          if (Math.abs(dx) < 7) return;
          drag.moved = true;
          slider.classList.add('dragging');
          slider.setPointerCapture(event.pointerId);
        }
        event.preventDefault();
        slider.scrollLeft = drag.left - dx;
      });
      function finishDrag(event) {
        if (!drag || event.pointerId !== drag.id) return;
        const snapshot = drag;
        const distance = slider.scrollLeft - snapshot.left;
        drag = null;
        slider.classList.remove('dragging');
        if (!snapshot.moved) return;
        suppressClick = true;
        const threshold = Math.min(85, slider.clientWidth * .16);
        const target = Math.abs(distance) > threshold ? snapshot.index + Math.sign(distance) : snapshot.index;
        go(target);
        if (slider.hasPointerCapture(event.pointerId)) slider.releasePointerCapture(event.pointerId);
      }
      slider.addEventListener('pointerup', finishDrag);
      slider.addEventListener('pointercancel', finishDrag);
      slider.addEventListener('pointerleave', event => { if (drag && !drag.moved) drag = null; });
      slider.addEventListener('click', event => {
        if (!suppressClick) return;
        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
      }, true);

      function fromHash() {
        const index = slides.findIndex(slide => `#${slide.id}` === location.hash);
        if (index >= 0) go(index, true);
      }
      window.addEventListener('hashchange', fromHash);
      window.addEventListener('resize', () => {
        cancelAnimationFrame(resizeFrame);
        const index = current;
        resizeFrame = requestAnimationFrame(() => go(index, true));
      });
      document.querySelector('#open-consult')?.addEventListener('click', () => dialog?.showModal());
      document.querySelectorAll('.dialog-close,.dialog-confirm').forEach(button => button.addEventListener('click', () => dialog.close()));
      dialog?.addEventListener('click', event => {
        const rect = dialog.getBoundingClientRect();
        if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
      });
      document.querySelector('#chapter-select')?.addEventListener('change', event => go(Number(event.target.value)));
      slider.querySelectorAll('a[href^="#"]').forEach(anchor => anchor.addEventListener('click', event => {
        const index = slides.findIndex(slide => `#${slide.id}` === anchor.getAttribute('href'));
        if (index >= 0) { event.preventDefault(); go(index); }
      }));
      sync(0, false);
      fromHash();
    })();
