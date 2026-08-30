import React from 'react';
import DarkModeSupport from '../components/DarkModeSupport.jsx';
import GlassmorphismSupport from '../components/GlassmorphismSupport.jsx';
import GradientBackgrounds from '../components/GradientBackgrounds.jsx';
import NineGradientPresets from '../components/NineGradientPresets.jsx';
import MultipleColorVariants from '../components/MultipleColorVariants.jsx';
import RoundedVariants from '../components/RoundedVariants.jsx';
import ShadowUtilities from '../components/ShadowUtilities.jsx';
import ShadowUtility from '../components/ShadowUtility.jsx';
import FloatingAnimation from '../components/FloatingAnimation.jsx';
import PulseAnimation from '../components/PulseAnimation.jsx';
import HoverActiveAnimations from '../components/HoverActiveAnimations.jsx';
import DisabledStateSupport from '../components/DisabledStateSupport.jsx';
import ReducedMotionSupport from '../components/ReducedMotionSupport.jsx';
import TooltipSupport from '../components/TooltipSupport.jsx';
import ReusableComponent from '../components/ReusableComponent.jsx';
import ResponsiveGridLayout from '../components/ResponsiveGridLayout.jsx';
import ResponsiveLayout from '../components/ResponsiveLayout.jsx';
import PointerCursor from '../components/PointerCursor.jsx';
import PointerCursorOnHover from '../components/PointerCursorOnHover.jsx';
import BookSync from '../components/BookSync.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ProfileButton from '../components/ProfileButton.jsx';
import { usePageMetadata } from '../hooks/usePageMetadata.js';

export default function DesignSystemPage() {
  usePageMetadata({
    title: 'Design System & Component Showcase',
    description: 'Visual UI tokens, animations, presets, and utility showcase.',
  });

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
        🎨 Design System & Theme Showcase
      </h1>
      <p style={{ color: 'var(--ink-soft, #64748b)', marginBottom: '32px' }}>
        A comprehensive gallery of UI utilities, background presets, animations, and interactive controls.
      </p>

      {/* Sync Status & Profile Action */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <BookSync />
        <div style={{ background: 'var(--surface-color, #f8fafc)', padding: '20px', borderRadius: '12px' }}>
          <h3>Profile Avatar Button</h3>
          <ProfileButton />
          <div style={{ marginTop: '16px' }}>
            <LoadingSpinner size="medium" />
          </div>
        </div>
      </section>

      {/* Theme & Glassmorphism */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <DarkModeSupport />
        <GlassmorphismSupport />
      </section>

      {/* Gradients */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <GradientBackgrounds />
        <NineGradientPresets />
      </section>

      {/* Utilities & Variants */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <MultipleColorVariants />
        <RoundedVariants />
        <ShadowUtilities />
        <ShadowUtility />
      </section>

      {/* Animations & Micro-interactions */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <FloatingAnimation />
        <PulseAnimation />
        <HoverActiveAnimations />
      </section>

      {/* Interactivity & Accessibility */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <DisabledStateSupport />
        <ReducedMotionSupport />
        <TooltipSupport />
      </section>

      {/* Layout & Reusable Utilities */}
      <section style={{ marginBottom: '32px' }}>
        <ReusableComponent />
        <div style={{ marginTop: '20px' }}>
          <ResponsiveLayout />
          <ResponsiveGridLayout />
        </div>
      </section>

      {/* Pointer Cursor Controls */}
      <section style={{ background: 'var(--surface-color, #f8fafc)', padding: '24px', borderRadius: '12px' }}>
        <h2>Pointer Cursor Micro-Interactions</h2>
        <PointerCursorOnHover />
        <div style={{ marginTop: '16px' }}>
          <PointerCursor style={{ padding: '12px 24px', background: 'var(--accent-color, #3b82f6)', color: '#fff', borderRadius: '8px', cursor: 'pointer', display: 'inline-block' }}>
            Interactive Ripple Cursor Box
          </PointerCursor>
        </div>
      </section>
    </main>
  );
}
