export const ANIMATION_TIMING = {
  BACKGROUND_FADE: 400, // Reduced from 1000
  LOGO_ENTRANCE: 400, // Reduced from 800
  TEXT_STAGGER: 200, // Reduced from 500
  BUTTON_DELAY: 1200, // Reduced from 2500
  SOCIAL_PROOF_DELAY: 1500, // Reduced from 3000
  CHARACTER_DELAY: 25, // Reduced from 50
  PARTICLE_DURATION: 3000, // Reduced from 6000
  FLOAT_DURATION: 1000, // Reduced from 2000
};

export const SPRING_CONFIG = {
  TIGHT: { tension: 300, friction: 12 }, // Faster: higher tension, lower friction
  MEDIUM: { tension: 150, friction: 15 }, // Faster
  LOOSE: { tension: 80, friction: 18 }, // Faster
  BOUNCE: { tension: 400, friction: 8 }, // Faster bounce
};

export const EASING = {
  EASE_IN_OUT: 'easeInOut',
  EASE_OUT: 'easeOut',
  EASE_IN: 'easeIn',
  LINEAR: 'linear',
};
