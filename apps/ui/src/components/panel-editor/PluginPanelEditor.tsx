import { useEffect, useState, type ReactNode } from "react";
import type { WidgetInstance } from "../../api";
import { PanelTitleFields, type AutomaticTitle } from "../PanelTitleFields";
import { readTitleIcon, writeTitleIcon } from "../../lib/panel-title-icon";
import { PanelEditorShell } from "./PanelEditorShell";

/** Edit menu of a panel that a plugin provides: its title and icon (the plugin draws the rest). */
export function PluginPanelEditor({
  open,
  widget,
  kindLabel,
  automatic = { title: null, icon: { iconId: "auto", kind: null } },
  onClose,
  onSave,
  renderPreview,
}: {
  open: boolean;
  widget: WidgetInstance;
  /** The plugin panel's name, e.g. "Morning summary". */
  kindLabel: string;
  automatic?: AutomaticTitle;
  onClose: () => void;
  onSave: (patch: Partial<WidgetInstance>) => void;
  renderPreview?: (patch: Partial<WidgetInstance>) => ReactNode;
}) {
  const [title, setTitle] = useState(widget.title ?? "");
  const [titleIcon, setTitleIcon] = useState(readTitleIcon(widget.config));
  useEffect(() => {
    if (!open) return;
    setTitle(widget.title ?? "");
    setTitleIcon(readTitleIcon(widget.config));
  }, [open, widget.id]);

  const buildPatch = (): Partial<WidgetInstance> => ({
    title: title.trim() || undefined,
    config: writeTitleIcon({ ...(widget.config ?? {}) }, titleIcon),
  });

  return (
    <PanelEditorShell
      open={open}
      title={`Edit ${title.trim() || automatic.title || kindLabel}`}
      kindLabel={`${kindLabel} (from a plugin)`}
      preview={open && renderPreview ? renderPreview(buildPatch()) : null}
      onCancel={onClose}
      onApply={() => {
        onSave(buildPatch());
        onClose();
      }}
      tabs={[
        {
          id: "look",
          label: "Look",
          content: (
            <PanelTitleFields
              title={title}
              onTitleChange={setTitle}
              icon={titleIcon}
              onIconChange={setTitleIcon}
              automatic={automatic}
            />
          ),
        },
      ]}
    />
  );
}
