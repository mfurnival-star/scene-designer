// Fixes Golden Layout ESM interop for Vite
export default {
  optimizeDeps: {
    include: ['golden-layout']
  },
  ssr: {
    noExternal: ['golden-layout']
  }
};
