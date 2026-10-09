(() => {
  'use strict';

  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const introPreview = root.classList.contains('is-intro-preview');

  // Match line widths through font size, preserving the font's natural proportions.
  const heroTitle = document.getElementById('hero-title');
  const heroSubtitle = document.querySelector('.hero-subtitle');
  const heroSubtitleText = document.querySelector('.hero-subtitle-text');
  if (heroTitle && heroSubtitle && heroSubtitleText) {
    const fitHeroSubtitle = () => {
      const titleWidth = heroTitle.getBoundingClientRect().width;
      const textWidth = heroSubtitleText.getBoundingClientRect().width;
      if (titleWidth <= 0 || textWidth <= 0 || Math.abs(titleWidth - textWidth) < 0.25) return;
      const fontSize = parseFloat(window.getComputedStyle(heroSubtitle).fontSize);
      heroSubtitle.style.setProperty('--hero-subtitle-size', `${fontSize * titleWidth / textWidth}px`);
    };
    fitHeroSubtitle();
    if ('ResizeObserver' in window) {
      new ResizeObserver(fitHeroSubtitle).observe(heroTitle);
    } else {
      window.addEventListener('resize', fitHeroSubtitle, { passive: true });
    }
    if (document.fonts) document.fonts.ready.then(fitHeroSubtitle);
  }

  // Only the cover image can hold the introduction open; slow assets never do.
  const heroImage = document.getElementById('hero-image');
  let introFinished = false;
  let introTimeout;
  const finishIntro = () => {
    if (introFinished) return;
    introFinished = true;
    window.clearTimeout(introTimeout);
    document.removeEventListener('keydown', skipIntroPreview);
    heroImage?.removeEventListener('load', decodeCover);
    heroImage?.removeEventListener('error', finishIntro);
    root.classList.remove('is-loading', 'is-intro-preview');
    root.classList.add('is-ready');
    if (!introPreview) {
      try {
        window.sessionStorage.setItem('yq-intro-seen', '1');
      } catch (_) {
        // The site remains usable when browser storage is unavailable.
      }
    }
  };
  const skipIntroPreview = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      finishIntro();
    }
  };
  const decodeCover = () => {
    if (typeof heroImage?.decode === 'function') {
      heroImage.decode().then(finishIntro, finishIntro);
    } else {
      finishIntro();
    }
  };

  if (introPreview) {
    // An explicit preview is independent of loading speed and visit history.
    introTimeout = window.setTimeout(finishIntro, 3200);
    document.addEventListener('keydown', skipIntroPreview);
  } else if (!root.classList.contains('is-loading') || reducedMotion.matches || !heroImage) {
    finishIntro();
  } else {
    introTimeout = window.setTimeout(finishIntro, 1400);
    heroImage.addEventListener('load', decodeCover, { once: true });
    heroImage.addEventListener('error', finishIntro, { once: true });
    if (heroImage.complete) decodeCover();
  }

  const mobile = window.matchMedia('(max-width: 800px)');
  const toggle = document.getElementById('menu-toggle');
  const navigation = document.getElementById('site-nav');
  const backdrop = document.getElementById('nav-backdrop');
  const links = Array.from(document.querySelectorAll('#site-nav .nav-link'));
  let menuOpen = false;

  const focusableNavigation = () => {
    if (!navigation || !toggle) return [];
    const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return [toggle, ...navigation.querySelectorAll(selector)].filter(element =>
      element.getClientRects().length && window.getComputedStyle(element).visibility !== 'hidden'
    );
  };

  const setMenu = (open, restoreFocus = false) => {
    if (!toggle || !navigation) return;
    menuOpen = Boolean(open && mobile.matches);
    document.body.classList.toggle('nav-open', menuOpen);
    toggle.setAttribute('aria-expanded', String(menuOpen));
    toggle.setAttribute('aria-label', menuOpen ? 'Close navigation' : 'Open navigation');
    if (restoreFocus) toggle.focus({ preventScroll: true });
    navigation.toggleAttribute('inert', mobile.matches && !menuOpen);
    if (backdrop) backdrop.hidden = !menuOpen;
  };

  if (toggle && navigation) {
    toggle.addEventListener('click', () => {
      setMenu(!menuOpen);
      if (menuOpen) focusableNavigation()[1]?.focus({ preventScroll: true });
    });
    if (backdrop) {
      backdrop.tabIndex = -1;
      backdrop.addEventListener('click', () => setMenu(false, true));
    }
    navigation.querySelectorAll('a[href^="#"]').forEach(link =>
      link.addEventListener('click', () => setMenu(false))
    );

    document.addEventListener('keydown', event => {
      if (!menuOpen) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenu(false, true);
      } else if (event.key === 'Tab') {
        const focusable = focusableNavigation();
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first) return;
        const current = document.activeElement;
        if (event.shiftKey && (current === first || !focusable.includes(current))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (current === last || !focusable.includes(current))) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    document.addEventListener('focusin', event => {
      if (menuOpen && event.target !== toggle && !navigation.contains(event.target)) {
        focusableNavigation()[0]?.focus({ preventScroll: true });
      }
    });

    const syncViewport = () => {
      const focusWillBeHidden = mobile.matches && navigation.contains(document.activeElement);
      setMenu(false, focusWillBeHidden);
    };
    if (mobile.addEventListener) mobile.addEventListener('change', syncViewport);
    else mobile.addListener(syncViewport);
    syncViewport();
  }

  const sections = links.map(link => ({
    link,
    section: document.getElementById(link.hash.slice(1))
  })).filter(item => item.section);
  let framePending = false;

  const updateScroll = () => {
    framePending = false;
    const scrollable = Math.max(0, root.scrollHeight - window.innerHeight);
    const progress = scrollable ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
    root.style.setProperty('--scroll-progress', String(progress));
    const threshold = Math.min(180, window.innerHeight * 0.3);
    let active = sections[0];
    for (const item of sections) {
      if (item.section.getBoundingClientRect().top <= threshold) active = item;
    }
    if (progress >= 0.999 && sections.length) active = sections[sections.length - 1];
    sections.forEach(item => {
      const selected = item === active;
      item.link.classList.toggle('is-active', selected);
      if (selected) item.link.setAttribute('aria-current', 'location');
      else item.link.removeAttribute('aria-current');
    });
  };
  const scheduleScrollUpdate = () => {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(updateScroll);
  };
  window.addEventListener('scroll', scheduleScrollUpdate, { passive: true });
  window.addEventListener('resize', scheduleScrollUpdate, { passive: true });
  window.addEventListener('hashchange', scheduleScrollUpdate);
  window.addEventListener('pageshow', scheduleScrollUpdate);
  window.addEventListener('load', scheduleScrollUpdate, { once: true });
  updateScroll();

  // Content is visible by default; only observed elements get reveal styling.
  let revealObserver;
  const revealElements = Array.from(document.querySelectorAll('[data-reveal]'));
  const revealAll = () => {
    revealObserver?.disconnect();
    revealElements.forEach(element => element.classList.add('is-visible'));
    root.classList.remove('has-reveals');
  };
  if (!reducedMotion.matches && 'IntersectionObserver' in window) {
    try {
      revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.05, rootMargin: '0px 0px 40px 0px' });
      revealElements.forEach(element => {
        if (element.getBoundingClientRect().top < window.innerHeight) {
          element.classList.add('is-visible');
        } else {
          revealObserver.observe(element);
        }
      });
      root.classList.add('has-reveals');
    } catch (_) {
      revealAll();
    }
  } else {
    revealAll();
  }

  const syncMotion = () => {
    if (reducedMotion.matches) {
      if (!introPreview) finishIntro();
      revealAll();
    }
  };
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', syncMotion);
  else reducedMotion.addListener(syncMotion);
})();
