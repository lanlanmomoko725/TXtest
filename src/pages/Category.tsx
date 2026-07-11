import { Navigate, useParams } from "react-router";

export default function CategoryPage() {
  const { categoryId, regionId } = useParams<{ categoryId?: string; regionId?: string }>();
  const search = new URLSearchParams();
  if (categoryId) search.set("category", categoryId);
  else if (regionId) search.set("region", regionId);
  return <Navigate replace to={`/sky-events?${search.toString()}`} />;
}
