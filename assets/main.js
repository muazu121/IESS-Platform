(() => {
  "use strict";

  const menuToggle = document.querySelector(".menu-toggle");
  const siteNav = document.querySelector(".site-nav");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const setMenuState = (open) => {
    if (!menuToggle || !siteNav) return;
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    siteNav.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);
    menuToggle.innerHTML = open
      ? '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 6 12 12M18 6 6 18"></path></svg>'
      : '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M4 12h16M4 17h16"></path></svg>';
  };

  menuToggle?.addEventListener("click", () => {
    setMenuState(menuToggle.getAttribute("aria-expanded") !== "true");
  });

  siteNav?.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMenuState(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMenuState(false);
      menuToggle?.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 820) setMenuState(false);
  });

  const year = document.getElementById("copyright-year");
  if (year) year.textContent = String(new Date().getFullYear());

  const revealItems = document.querySelectorAll(".reveal");
  if (!reduceMotion && "IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -36px" }
    );
    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  const counters = document.querySelectorAll("[data-count]");
  const animateCounter = (counter) => {
    const target = Number(counter.dataset.count);
    if (!Number.isFinite(target)) return;
    if (reduceMotion) {
      counter.textContent = String(target);
      return;
    }

    const duration = 900;
    const start = performance.now();
    const update = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      counter.textContent = String(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  };

  if ("IntersectionObserver" in window) {
    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach((counter) => counterObserver.observe(counter));
  }

  const sectionLinks = [...document.querySelectorAll('.site-nav a[href^="#"]')];
  const observedSections = sectionLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if ("IntersectionObserver" in window && observedSections.length) {
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          sectionLinks.forEach((link) => {
            const current = link.getAttribute("href") === `#${entry.target.id}`;
            if (current) link.setAttribute("aria-current", "true");
            else link.removeAttribute("aria-current");
          });
        });
      },
      { rootMargin: "-28% 0px -62% 0px", threshold: 0.01 }
    );
    observedSections.forEach((section) => navObserver.observe(section));
  }

  const contactForm = document.getElementById("contact-form");
  const formStatus = document.getElementById("form-status");
  contactForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!contactForm.reportValidity()) return;

    const data = new FormData(contactForm);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const interest = String(data.get("interest") || "").trim();
    const message = String(data.get("message") || "").trim();

    const subject = `IESS enquiry: ${interest}`;
    const body = [
      "Hello IESS,",
      "",
      message,
      "",
      `Name: ${name}`,
      `Email: ${email}`,
      phone ? `Phone / WhatsApp: ${phone}` : "",
      `Interested in: ${interest}`,
      "",
      "This message was prepared from the IESS website.",
    ]
      .filter((line) => line !== "")
      .join("\n");

    const mailto = `mailto:integratedpower.iess@gmail.com?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    if (formStatus) {
      formStatus.textContent =
        "Your email app should open with the message ready to review. Nothing has been sent yet.";
      formStatus.classList.add("is-visible");
    }

    window.location.href = mailto;
  });
})();
