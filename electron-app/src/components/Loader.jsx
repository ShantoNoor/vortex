export const Loader = ({ opacity = "0.8" }) => {
  return (
    <div
      style={{ height: "100dvh", width: "100%", opacity }}
      className="bg-[#222] flex justify-center items-center z-20"
    >
      <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-blue-600"></div>
    </div>
  );
};
