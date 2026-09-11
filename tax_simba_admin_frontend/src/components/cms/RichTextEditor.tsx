"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

const CKEditor = dynamic(
  async () => (await import("@ckeditor/ckeditor5-react")).CKEditor,
  { ssr: false }
) as any;

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeightClassName?: string;
};

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write your article...",
  minHeightClassName = "min-h-[260px]",
}: Props) {
  const [EditorClass, setEditorClass] = useState<any>(null);
  
  // Use a ref to track if a change came from the editor itself
  const isInternalChange = React.useRef(false);
  const [editorData, setEditorData] = useState(value ?? "");

  useEffect(() => {
    (async () => {
      const mod = await import("./CustomClassicEditor");
      setEditorClass(() => mod.default);
    })();
  }, []);

  // Update editorData only if the change came from outside (e.g. loading an article)
  useEffect(() => {
    if (!isInternalChange.current) {
      setEditorData(value ?? "");
    }
    isInternalChange.current = false;
  }, [value]);

  const minHeightPx = useMemo(() => {
    const m = minHeightClassName.match(/min-h-\[(\d+)px\]/);
    return m ? Number(m[1]) : 260;
  }, [minHeightClassName]);

  if (!EditorClass) return null;

  return (
    <div className="rounded border border-gray-300 bg-white">
      <style jsx global>{`
        .ck.ck-editor__editable {
          min-height: ${minHeightPx}px;
        }
      `}</style>

      <CKEditor
        editor={EditorClass}
        data={editorData}
        config={{
          ...EditorClass.defaultConfig, 
          placeholder,
        }}
        onChange={(_: any, editor: any) => {
          isInternalChange.current = true;
          onChange(editor.getData());
        }}
      />
    </div>
  );
}
