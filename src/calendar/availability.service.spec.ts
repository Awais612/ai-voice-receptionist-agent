import { AvailabilityService } from "./availability.service";
import { BusinessConfig } from "../config/business.config";

const list = jest.fn();
const googleStub = {
  getCalendar: () => ({ events: { list } }),
  calendarId: "primary",
} as any;

describe("AvailabilityService", () => {
  const svc = new AvailabilityService(googleStub, new BusinessConfig());

  beforeEach(() => jest.clearAllMocks());

  it("marks a slot full only at capacity (2)", async () => {
    list.mockResolvedValue({
      data: {
        items: [
          { start: { dateTime: "2026-06-23T10:00:00Z" }, end: { dateTime: "2026-06-23T11:00:00Z" } },
          { start: { dateTime: "2026-06-23T10:00:00Z" }, end: { dateTime: "2026-06-23T11:00:00Z" } },
        ],
      },
    });
    const slots = await svc.getOpenSlots("2026-06-23");
    expect(slots).not.toContain("10:00");
    expect(slots).toContain("09:00");
  });

  it("keeps a slot open with one event (below capacity)", async () => {
    list.mockResolvedValue({
      data: {
        items: [
          { start: { dateTime: "2026-06-23T11:00:00Z" }, end: { dateTime: "2026-06-23T12:00:00Z" } },
        ],
      },
    });
    const slots = await svc.getOpenSlots("2026-06-23");
    expect(slots).toContain("11:00");
  });

  it("returns empty array for a non-business day (Sunday)", async () => {
    // 2026-06-21 is a Sunday
    const slots = await svc.getOpenSlots("2026-06-21");
    expect(slots).toEqual([]);
    expect(list).not.toHaveBeenCalled();
  });
});
