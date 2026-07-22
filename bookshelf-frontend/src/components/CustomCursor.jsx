import { useEffect, useRef } from 'react';
import './CustomCursor.css';

const HOVER_SELECTOR =
  'a, button, input, textarea, select, label, [role="button"], .book-card, .shelf__spine, .genre-filter__chip';

export default function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    const isTouchDevice =
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window;

    if (isTouchDevice) return;

    document.body.classList.add('custom-cursor-active');

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;
    let rafId;

    function moveDot() {
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
      }
    }

    function handleMouseMove(event) {
      mouseX = event.clientX;
      mouseY = event.clientY;
      moveDot();

      if (prefersReducedMotion && ringRef.current) {
        ringRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
      }
    }

    function animateRing() {
      ringX += (mouseX - ringX) * 0.15;
      ringY += (mouseY - ringY) * 0.15;

      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
      }

      rafId = requestAnimationFrame(animateRing);
    }

    function handleMouseDown() {
      ringRef.current?.classList.add('custom-cursor__ring--click');
    }

    function handleMouseUp() {
      ringRef.current?.classList.remove('custom-cursor__ring--click');
    }

    function handleMouseOver(event) {
      if (
        event.target instanceof Element &&
        event.target.closest(HOVER_SELECTOR)
      ) {
        ringRef.current?.classList.add('custom-cursor__ring--hover');
      }
    }

    function handleMouseOut(event) {
      if (
        event.target instanceof Element &&
        event.target.closest(HOVER_SELECTOR)
      ) {
        ringRef.current?.classList.remove('custom-cursor__ring--hover');
      }
    }

    function handleLeaveWindow() {
      dotRef.current?.classList.add('custom-cursor--hidden');
      ringRef.current?.classList.add('custom-cursor--hidden');
    }

    function handleEnterWindow() {
      dotRef.current?.classList.remove('custom-cursor--hidden');
      ringRef.current?.classList.remove('custom-cursor--hidden');
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mouseover', handleMouseOver);
    window.addEventListener('mouseout', handleMouseOut);

    document.addEventListener('mouseleave', handleLeaveWindow);
    document.addEventListener('mouseenter', handleEnterWindow);

    moveDot();

    if (!prefersReducedMotion) {
      animateRing();
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseover', handleMouseOver);
      window.removeEventListener('mouseout', handleMouseOut);

      document.removeEventListener('mouseleave', handleLeaveWindow);
      document.removeEventListener('mouseenter', handleEnterWindow);

      if (rafId) {
        cancelAnimationFrame(rafId);
      }

      document.body.classList.remove('custom-cursor-active');
    };
  }, []);

  return (
    <>
      <div ref={ringRef} className="custom-cursor__ring" />
      <div ref={dotRef} className="custom-cursor__dot" />
    </>
  );
}