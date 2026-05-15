import { createFileRoute } from "@tanstack/react-router";
import { SlideshowEditor } from "@/components/SlideshowEditor";

export const Route = createFileRoute("/_authenticated/app/slideshow/new")({
  component: () => <SlideshowEditor />,
});
