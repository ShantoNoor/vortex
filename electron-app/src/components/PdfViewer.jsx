export default function PdfViewer({ fileId }) {
  return (
    <div className="flex-1 h-full w-full flex flex-col items-center justify-center bg-[#111] text-white absolute inset-0">
      <div className="text-6xl mb-4">📄</div>
      <h2 className="text-2xl font-semibold mb-2">PDF Viewer Placeholder</h2>
      <p className="text-neutral-400">
        Ready to render file:{" "}
        <span className="text-orange-400 font-mono text-sm ml-2">{fileId}</span>
      </p>
    </div>
  );
}
