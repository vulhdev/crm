export function TableLoadingSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b border-[#E2DED9]/60">
          {/* Name cell */}
          <td className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="skeleton w-8 h-8 rounded-full shrink-0" />
              <div className="flex flex-col gap-1.5 flex-1">
                <div className="skeleton h-3 w-32" />
                <div className="skeleton h-2.5 w-44" />
              </div>
            </div>
          </td>
          {/* Company */}
          <td className="px-4 py-3">
            <div className="skeleton h-3 w-28" />
          </td>
          {/* Status */}
          <td className="px-4 py-3">
            <div className="skeleton h-[22px] w-16 rounded-full" />
          </td>
          {/* Last Contact */}
          <td className="px-4 py-3">
            <div className="skeleton h-3 w-24" />
          </td>
          {/* Actions */}
          <td className="px-4 py-3">
            <div className="skeleton w-7 h-7 rounded-md" />
          </td>
        </tr>
      ))}
    </>
  );
}
