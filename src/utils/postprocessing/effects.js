import { Vector2 } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createPostProcessing(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Improved bloom settings
  const bloomPass = new UnrealBloomPass(
    new Vector2(window.innerWidth, window.innerHeight),
    1.4,   // strength - "figure of light"
    0.7,   // radius - soft halo
    0.12   // threshold
  );
  composer.addPass(bloomPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  const instance = {
    render: () => composer.render(),
    resize(width, height) {
      composer.setSize(width, height);
      bloomPass.resolution.set(width, height);
    },
    setBloomColor(color) {
      // Bloom tint approximation: boost bloom strength briefly on skin change
      bloomPass.strength = 2.0;
      setTimeout(() => { bloomPass.strength = 1.4; }, 600);
      void color;
    }
  };

  return instance;
}
