/** Match the marketplace's saved service-area rules; unknown locations stay hidden. */
export function shopServesLocation(locations: { location_name: string }[] | undefined, customerLocation: string): boolean {
  const customer = customerLocation.trim().toLowerCase();
  if (!customer || !locations?.length) return false;
  return locations.some(location => {
    const name = location.location_name?.trim().toLowerCase();
    return !!name && customer.includes(name);
  });
}
