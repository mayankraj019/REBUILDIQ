import { describe, it, expect } from 'vitest';
import { tokens } from '../lib/design-system/tokens';

describe('RebuildIQ Design Tokens Validation', () => {
  it('should enforce exact brand palette hex codes', () => {
    expect(tokens.colors.brand.navy).toBe('#14213D');
    expect(tokens.colors.brand.cream).toBe('#F4EDE0');
    expect(tokens.colors.brand.coral).toBe('#FF6B5B');
  });

  it('should define accessible surface and text tokens', () => {
    expect(tokens.colors.surface.canvas).toBe('#F4EDE0');
    expect(tokens.colors.surface.card).toBe('#FFFFFF');
    expect(tokens.colors.surface.dark).toBe('#14213D');

    expect(tokens.colors.text.primary).toBe('#14213D');
    expect(tokens.colors.text.inverse).toBe('#F4EDE0');
    expect(tokens.colors.text.accent).toBe('#FF6B5B');
  });

  it('should provide full typography and spacing scales', () => {
    expect(tokens.typography.sizes.xs.fontSize).toBe('0.75rem');
    expect(tokens.typography.sizes.base.fontSize).toBe('1rem');
    expect(tokens.typography.sizes['4xl'].fontSize).toBe('2.25rem');

    expect(tokens.spacing[0]).toBe('0px');
    expect(tokens.spacing[4]).toBe('1rem');
    expect(tokens.spacing[16]).toBe('4rem');
  });

  it('should define responsive breakpoints adhering to architecture specifications', () => {
    expect(tokens.breakpoints.mobile).toBe('375px');
    expect(tokens.breakpoints.tablet).toBe('768px');
    expect(tokens.breakpoints.desktop).toBe('1280px');
  });

  it('should define restrained elevation and focus styles', () => {
    expect(tokens.elevation.flat).toBe('none');
    expect(tokens.elevation.raised).toContain('rgba(20, 33, 61');
    expect(tokens.focus.ring).toContain('#14213D');
  });
});
