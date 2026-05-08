// Ambient module declaration for html2canvas v1.x.
// Script file (no top-level import/export) so that "declare module" is treated
// as an ambient declaration rather than augmentation.
declare module 'html2canvas' {
  interface Html2CanvasOptions {
    allowTaint?: boolean;
    useCORS?: boolean;
    logging?: boolean;
    scale?: number;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    backgroundColor?: string | null;
    imageTimeout?: number;
    ignoreElements?: (element: Element) => boolean;
  }
  function html2canvas(
    element: HTMLElement,
    options?: Html2CanvasOptions,
  ): Promise<HTMLCanvasElement>;
  export default html2canvas;
}
