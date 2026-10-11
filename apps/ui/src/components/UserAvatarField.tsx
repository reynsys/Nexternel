import { useRef, useState } from "react";
import { Avatar, Button, Stack, Typography } from "@mui/material";
import { fileToAvatarDataUrl, userInitial } from "../lib/user-display";
import { useConfirm } from "./confirm";

type Props = {
  avatarData: string | null;
  /** Used for letter fallback */
  displayName?: string | null;
  username?: string;
  onChange: (next: string | null) => void;
};

export function UserAvatarField({
  avatarData,
  displayName,
  username,
  onChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirm } = useConfirm();

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      onChange(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read image");
    }
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">Profile picture</Typography>
      <Stack direction="row" spacing={2} alignItems="center">
        <Avatar
          src={avatarData ?? undefined}
          sx={{ width: 64, height: 64, bgcolor: "primary.dark" }}
        >
          {userInitial({ displayName, username })}
        </Avatar>
        <Stack spacing={1}>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/jpg"
            hidden
            onChange={(e) => {
              void onPick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={() => inputRef.current?.click()}
          >
            Upload image
          </Button>
          {avatarData && (
            <Button
              size="small"
              color="inherit"
              onClick={() => {
                void (async () => {
                  const ok = await confirm({
                    title: "Remove picture?",
                    message: "Remove your profile picture?",
                    confirmLabel: "Remove picture",
                  });
                  if (ok) onChange(null);
                })();
              }}
            >
              Remove picture
            </Button>
          )}
        </Stack>
      </Stack>
      {error && (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary">
        Square photos work best. Images are resized automatically.
      </Typography>
    </Stack>
  );
}
