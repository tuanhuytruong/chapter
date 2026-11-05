/** Chapter adaptations, not literal Nousa source. Pinned reference tree:
 * 27b753e64171ef0457c5ec03b12235b50a3dd523, kit-Cyd3RICo.js.
 * xl route 180/700; oo cards 800/60; yo lift 450/500;
 * Xc drawer 600/320; Zc modal 500/200 (mobile 550/300);
 * adjacent popover 400/150. Cubic approximations replace GSAP eases.
 * Press160 and local disclosure180 are existing Chapter feedback adaptations.
 * No reference fonts, colors, vendor code or application bundle is copied.
 */
export const uiMotion = {
  ease: 'cubic-bezier(.22,1,.36,1)',
  exitEase: 'cubic-bezier(.55,0,1,.45)',
  menu: { enter: 400, exit: 150 },
  modal: { enter: 500, exit: 200 },
  drawer: { enter: 600, exit: 320 },
  disclosure: { enter: 180, exit: 180 },
} as const;
export type SurfaceFamily = keyof Pick<typeof uiMotion, 'menu' | 'modal' | 'drawer' | 'disclosure'>;
