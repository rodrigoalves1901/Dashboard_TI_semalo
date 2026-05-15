import { createFileRoute } from "@tanstack/react-router";
import { SlideshowEditor } from "@/components/SlideshowEditor";

export const Route = createFileRoute("/_authenticated/app/slideshow/$id/edit")({
  component: EditSlideshow,
});

function EditSlideshow() {
  const { id } = Route.useParams();
  return <SlideshowEditor slideshowId={id} />;
}
