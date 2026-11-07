import { createContext, useContext } from "react";
import type { PanelPictures } from "../panels/flow-layout";

/**
 * Between a dashboard panel and its section: a panel of pictures (cameras) says how many it shows
 * and their shape, so a narrow screen can give it the height to show them under each other;
 * the section says back how many fit side by side on this screen (null = as arranged).
 */
export type PanelPicturesLink = {
  report: (pictures: PanelPictures | null) => void;
  across: number | null;
};

export const PanelPicturesContext = createContext<PanelPicturesLink | null>(null);

export function usePanelPictures(): PanelPicturesLink | null {
  return useContext(PanelPicturesContext);
}
