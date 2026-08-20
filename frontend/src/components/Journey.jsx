import { Check, Circle, Loader } from "lucide-react";

export function Journey({ steps }) {
  return (
    <ol data-testid="tax-journey" className="flex flex-col md:flex-row gap-4 md:gap-0">
      {(steps || []).map((s, i) => {
        const done = s.state === "Completed";
        const active = s.state === "In Progress";
        return (
          <li key={s.step} data-testid={`journey-step-${i}`} className="flex-1 flex md:flex-col gap-3 md:gap-2 items-start md:items-center relative">
            <div className="flex items-center w-full">
              <div className="hidden md:block flex-1 h-[2px]" style={{ background: i === 0 ? "transparent" : done || active ? "#078A4B" : "#E3E7E4" }} />
              <div
                className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center border-2"
                style={{
                  borderColor: done ? "#16A05D" : active ? "#078A4B" : "#E3E7E4",
                  backgroundColor: done ? "#16A05D" : active ? "#EAF5EE" : "#FFFFFF",
                }}
              >
                {done ? <Check size={16} color="#fff" /> : active ? <Loader size={16} color="#078A4B" /> : <Circle size={12} color="#B4BCB7" />}
              </div>
              <div className="hidden md:block flex-1 h-[2px]" style={{ background: i === steps.length - 1 ? "transparent" : done ? "#078A4B" : "#E3E7E4" }} />
            </div>
            <div className="md:text-center">
              <div className="text-sm font-semibold text-[#161B18]">{s.step}</div>
              <div className="text-xs" style={{ color: done ? "#16A05D" : active ? "#078A4B" : "#626A65" }}>
                {s.state}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
