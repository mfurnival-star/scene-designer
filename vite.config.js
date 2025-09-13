// Fixes Golden Layout ESM interop for Vite (see scene-designer Copilot Space)
export default {
  optimizeDeps: {
    include: ['golden-layout']
  },
  ssr: {
    noExternal: ['golden-layout']
  }
};
