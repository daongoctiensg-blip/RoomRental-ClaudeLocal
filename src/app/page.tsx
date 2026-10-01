import Link from "next/link";
import { listProperties, listRooms } from "@/lib/db";
import { isAdminSession } from "@/lib/apiAuth";
import RoomCard from "@/components/RoomCard";
import FilterBar from "@/components/FilterBar";
import MainSearchBar from "@/components/MainSearchBar";
import QuickBuildingFilter from "@/components/QuickBuildingFilter";
import NearMeButton from "@/components/NearMeButton";
import SortControl from "@/components/SortControl";
import LogoutButton from "@/components/LogoutButton";
import { NEARBY_RADIUS_KM } from "@/lib/geocode";
import { PUBLIC_STATUSES, publicPropertyIds } from "@/lib/publicVisibility";
import type { LocationCounts } from "@/lib/locationSearch";
import { matchesFilters, parseFilterState, parseNear, toFacetRoom } from "@/lib/roomFilters";
import { listAmenities } from "@/lib/amenityCatalog";
import SavedRoomsLink from "@/components/SavedRoomsLink";
import MobileHomeControls from "@/components/mobile/MobileHomeControls";
import MobileRoomCard from "@/components/mobile/MobileRoomCard";
import MobileFloatingBar from "@/components/mobile/MobileFloatingBar";

export const dynamic = "force-dynamic";

const DEFAULT_CITY = "Thành phố Hồ Chí Minh";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const get = (k: string) => firstValue(sp[k]);
  // Status / price / occupancy / amenities / balcony — round 13: applied in
  // JS via src/lib/roomFilters.ts (the same code the mobile "Lọc theo"
  // screen reruns in the browser to show live counts per option). Location
  // and sort still narrow the candidate set in listRooms() below.
  const admin = await isAdminSession();
  // Round 15: guests only ever see "Còn trống" rooms — ?status= is ignored
  // for them, and non-available rooms are never even loaded (see
  // src/lib/publicVisibility.ts). Admins keep the full status filter.
  const parsedFilters = parseFilterState(get);
  const filters = admin ? parsedFilters : { ...parsedFilters, statuses: [...PUBLIC_STATUSES] };
  const guestStatus = admin ? undefined : [...PUBLIC_STATUSES];

  const address = get("address");
  // Default to Thành phố Hồ Chí Minh when the customer hasn't touched the
  // city filter at all (no ?city= in the URL) — Boss's properties are all
  // there right now, so an empty first-visit homepage looked broken. "all"
  // is an explicit marker meaning the customer picked "Tất cả thành phố /
  // tỉnh" themselves (see MainSearchBar's setCity) — distinct from the param
  // being absent, so "show everything" stays reachable and doesn't get
  // silently overridden back to the default on the next render.
  const cityRaw = get("city");
  const cityChoice = cityRaw === undefined ? DEFAULT_CITY : cityRaw === "all" ? undefined : cityRaw;
  const ward = get("ward");
  const district = get("district");
  const sortParam = get("sort");
  const sortBy =
    sortParam === "price_asc" || sortParam === "price_desc" || sortParam === "newest"
      ? sortParam
      : "default";
  // "Phòng gần vị trí của tôi" — round 13 (mobile search screen).
  const near = parseNear(get("near")) ?? undefined;
  // "Near me" is a location on its own — the city dropdown doesn't narrow it.
  const city = near ? undefined : cityChoice;
  // "Khu vực nhanh" — round 10, §12. Same propertyId param GET /api/rooms
  // already understands.
  const propertyId = get("propertyId");

  // "Đã lưu" — round 12. `saved=id1,id2` comes from the visitor's own
  // browser (SavedRoomsLink) and ignores the other filters. Round 15: a
  // guest only gets the saved rooms that are still available; the rest are
  // just counted ("N phòng đã lưu không còn trống"), never shown.
  const savedParam = get("saved");
  const savedIds = savedParam
    ? new Set(savedParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 100))
    : null;

  const [listed, properties, catalog, availableEverywhere] = await Promise.all([
    savedIds
      ? listRooms({ sortBy, status: guestStatus })
      : listRooms({ city, ward, district, address, near, propertyId, sortBy, status: guestStatus }),
    listProperties(),
    listAmenities(),
    // "Khu vực đang có phòng trống", the building list and — for guests —
    // which buildings may be shown at all (≥ 1 available room).
    listRooms({ status: ["available"] }),
  ]);
  // Candidate rooms for the current location, before price/amenities/... —
  // the basis for the mobile filter screen's live counts.
  const base = savedIds ? listed.filter((r) => savedIds.has(r.id)) : listed;
  const hiddenSavedCount = savedIds ? savedIds.size - base.length : 0;
  const facets = base.map(toFacetRoom);
  const rooms = savedIds ? base : base.filter((_, i) => matchesFilters(facets[i], filters));
  const buildingsWithRooms = publicPropertyIds(availableEverywhere);
  const quickBuildings = properties.filter(
    (p) => p.isActive && (admin || buildingsWithRooms.has(p.id))
  );

  // ---- Mobile (< md) data — round 13 --------------------------------
  const popularAmenityNames = catalog.filter((a) => a.isPopular).map((a) => a.name);
  const shortCity = (c: string) => c.replace(/^Thành phố\s+/i, "TP. ").replace(/^Tỉnh\s+/i, "");
  const activeProperties = properties.filter((p) => p.isActive);
  const selectedBuilding = propertyId ? activeProperties.find((p) => p.id === propertyId) : undefined;
  const mobileTitle = savedIds
    ? "Phòng đã lưu"
    : near
      ? "Gần vị trí của tôi (2 km)"
      : address
        ? address
        : selectedBuilding
          ? selectedBuilding.name
          : ward || district || (city ? shortCity(city) : "Tất cả thành phố / tỉnh");

  // "Khu vực đang có phòng trống": real available-room counts per
  // ward, per old district and per city (all cities, not just the current).
  const areaCounts = new Map<string, { label: string; sub: string; query: string; count: number }>();
  const bump = (key: string, label: string, sub: string, query: string) => {
    const cur = areaCounts.get(key) ?? { label, sub, query, count: 0 };
    cur.count++;
    areaCounts.set(key, cur);
  };
  const buildingCounts = new Map<string, number>();
  for (const r of availableEverywhere) {
    const p = r.property;
    const c = encodeURIComponent(p.city);
    if (p.ward) bump(`w:${p.city}|${p.ward}`, p.ward, shortCity(p.city), `city=${c}&ward=${encodeURIComponent(p.ward)}`);
    if (p.district)
      bump(`d:${p.district}`, `${p.district} (cũ)`, "Quận/huyện cũ", `city=${c}&district=${encodeURIComponent(p.district)}`);
    if (p.city) bump(`c:${p.city}`, `Tất cả ${shortCity(p.city)}`, "Thành phố / tỉnh", `city=${c}`);
    buildingCounts.set(p.id, (buildingCounts.get(p.id) ?? 0) + 1);
  }
  const areas = [...areaCounts.entries()]
    .sort(([a], [b]) => "wdc".indexOf(a[0]) - "wdc".indexOf(b[0]))
    .map(([, v]) => v);
  const buildings = activeProperties
    .filter((p) => (buildingCounts.get(p.id) ?? 0) > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      address: p.addressNew,
      ward: p.ward,
      photo: p.images[0] ?? availableEverywhere.find((r) => r.propertyId === p.id)?.images[0],
      available: buildingCounts.get(p.id) ?? 0,
    }));
  // Round 16: available-room counts for the mobile search type-ahead.
  const locationCounts: LocationCounts = { city: {}, ward: {}, district: {} };
  for (const r of availableEverywhere) {
    const p = r.property;
    if (p.city) locationCounts.city[p.city] = (locationCounts.city[p.city] ?? 0) + 1;
    if (p.city && p.ward) {
      const k = `${p.city}|${p.ward}`;
      locationCounts.ward[k] = (locationCounts.ward[k] ?? 0) + 1;
    }
    if (p.district) locationCounts.district[p.district] = (locationCounts.district[p.district] ?? 0) + 1;
  }
  const onlyAvailable =
    !savedIds && filters.statuses.length === 1 && filters.statuses[0] === "available";

  return (
    <div className="flex min-h-screen flex-col">
      <header className={`${admin ? "" : "hidden md:block"} border-b border-black/5 bg-white`}>
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4 sm:px-6 lg:px-10">
          <div className="text-xl font-bold tracking-tight text-[color:var(--color-accent-dark)]">
            Phòng Cho Thuê
          </div>
          <div className="flex items-center gap-3">
          <span className="hidden md:inline-flex">
            <SavedRoomsLink />
          </span>
          {admin ? (
            <div className="flex items-center gap-3">
              <span className="hidden rounded-full bg-amber-100 sm:inline px-2.5 py-1 text-xs font-medium text-amber-800">
                Đang xem với quyền Admin
              </span>
              <Link
                href="/admin"
                className="text-xs font-medium text-slate-400 hover:text-slate-600"
              >
                Vào trang quản trị
              </Link>
              <LogoutButton redirectTo="/" className="text-xs font-medium text-slate-400 hover:text-slate-600" />
            </div>
          ) : (
            <Link
              href="/admin"
              className="text-xs font-medium text-slate-400 hover:text-slate-600"
            >
              Quản trị
            </Link>
          )}
          </div>
        </div>
      </header>

      {/* ---- Mobile (< md) — round 13, Claude Design "1 · Trang chủ" ---- */}
      <div className="flex flex-1 flex-col md:hidden">
        <MobileHomeControls
          title={mobileTitle}
          facets={savedIds ? [] : facets}
          popularAmenities={popularAmenityNames}
          areas={areas}
          buildings={buildings}
          counts={locationCounts}
          currentCity={city}
          admin={admin}
        />
        <div className="px-3 pb-1 pt-2.5 text-[13px] text-[#5b6475]">
          {savedIds ? (
            <>
              <strong className="text-[#16233b]">Phòng đã lưu ({rooms.length})</strong> ·{" "}
              <Link href="/" className="font-medium text-[color:var(--color-accent)]!">
                Tất cả phòng
              </Link>
              {hiddenSavedCount > 0 ? (
                <span className="mt-1 block">{savedHiddenNote(hiddenSavedCount)}</span>
              ) : null}
            </>
          ) : (
            <>
              Tìm thấy <strong className="text-[#16233b]">{rooms.length} phòng</strong>
              {onlyAvailable ? " còn trống" : ""}
              {near || address || propertyId ? (
                <>
                  {" · "}
                  <Link href="/" className="font-medium text-[color:var(--color-accent)]!">
                    Xoá tìm kiếm
                  </Link>
                </>
              ) : null}
            </>
          )}
        </div>
        <div className="flex flex-col gap-2.5 px-3 pb-24 pt-1">
          {rooms.length === 0 ? (
            <div className="rounded-[14px] border border-[#e8ebf1] bg-white p-6 text-center text-sm text-slate-500">
              {savedIds
                ? "Các phòng anh/chị đã lưu hiện không còn trống."
                : near
                  ? "Chưa có phòng nào trong vòng 2 km quanh vị trí của anh/chị."
                  : "Không tìm thấy phòng phù hợp với bộ lọc hiện tại."}
            </div>
          ) : (
            rooms.map((room) => (
              <MobileRoomCard
                key={room.id}
                room={room}
                catalog={catalog}
                showStatus={!onlyAvailable}
              />
            ))
          )}
          {admin ? null : (
            <Link href="/admin" className="self-center py-3 text-xs text-slate-400!">
              Quản trị
            </Link>
          )}
        </div>
        <MobileFloatingBar near={near} radiusKm={NEARBY_RADIUS_KM} />
      </div>

      <main className="mx-auto hidden w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 md:block lg:px-10">
        <div className="mb-4">
          <MainSearchBar />
        </div>

        <div className="mb-6">
          <QuickBuildingFilter
            properties={quickBuildings
              .map((p) => ({ id: p.id, name: p.name }))}
          />
        </div>

        <NearMeButton active={Boolean(near)} radiusKm={NEARBY_RADIUS_KM} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <FilterBar
              popularAmenities={catalog
                .filter((a) => a.isPopular)
                .map((a) => ({ name: a.name, icon: a.icon }))}
              showStatus={admin}
            />
          </aside>

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {savedIds ? `Phòng đã lưu (${rooms.length})` : `Tìm thấy ${rooms.length} phòng`}
                </h1>
                <p className="text-sm text-slate-500">
                  {savedIds ? (
                    <>
                      Các phòng anh/chị đã bấm ♡ Lưu trên máy này.{" "}
                      <Link href="/" className="font-medium text-[color:var(--color-accent)] hover:underline">
                        ← Quay lại tất cả phòng
                      </Link>
                      {hiddenSavedCount > 0 ? (
                        <span className="mt-1 block">{savedHiddenNote(hiddenSavedCount)}</span>
                      ) : null}
                    </>
                  ) : (
                    admin
                      ? "Xem danh sách phòng, lọc theo địa chỉ, trạng thái và giá thuê."
                      : "Danh sách phòng còn trống, lọc theo địa chỉ, giá thuê và tiện ích."
                  )}
                </p>
              </div>
              <SortControl />
            </div>

            {rooms.length === 0 ? (
              <div className="rounded-xl bg-white p-8 text-center text-slate-500 shadow-sm ring-1 ring-black/5">
                {savedIds
                  ? "Các phòng anh/chị đã lưu hiện không còn trống."
                  : "Không tìm thấy phòng phù hợp với bộ lọc hiện tại."}
              </div>
            ) : (
              rooms.map((room) => (
                <RoomCard key={room.id} room={room} admin={admin} catalog={catalog} />
              ))
            )}
          </div>
        </div>
      </main>

      <footer className="hidden border-t md:block border-black/5 bg-white py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Phòng Cho Thuê
      </footer>
    </div>
  );
}

/** Round 15: saved rooms that are no longer available are only counted —
 * never shown — for a guest (and deleted/unlisted ones for everyone). */
function savedHiddenNote(n: number): string {
  return `${n} phòng anh/chị đã lưu hiện không còn trống nên không hiển thị.`;
}
