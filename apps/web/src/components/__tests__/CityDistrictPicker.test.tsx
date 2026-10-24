import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CityDistrictPicker, type LocationSelection } from "../CityDistrictPicker";

function Harness({ onChange }: { onChange?: (next: LocationSelection) => void }) {
  const [sel, setSel] = useState<LocationSelection>({ cities: [], districtKeys: [] });
  return (
    <CityDistrictPicker
      selectedCities={sel.cities}
      selectedDistrictKeys={sel.districtKeys}
      onChange={(next) => {
        setSel(next);
        onChange?.(next);
      }}
      onReset={() => setSel({ cities: [], districtKeys: [] })}
      onNearMe={() => undefined}
      nearMeLoading={false}
      nearMeActive={false}
    />
  );
}

async function pickCity(name: string) {
  await userEvent.click(screen.getByRole("button", { name: "City" }));
  await userEvent.click(screen.getByRole("button", { name }));
}

describe("CityDistrictPicker", () => {
  it("picks one city, then narrows to that city's districts only", async () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);
    // Districts is on screen from the start, but greyed out until a city is picked.
    expect(screen.getByRole("button", { name: "Districts" })).toBeDisabled();

    await pickCity("İzmir");
    expect(onChange).toHaveBeenLastCalledWith({ cities: ["İzmir"], districtKeys: [] });

    // Now usable; open, only İzmir's districts, with "All" on.
    expect(screen.getByRole("button", { name: "Districts" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Districts" }));
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("checkbox", { name: "Çankaya" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Buca" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Bornova" }));
    expect(onChange).toHaveBeenLastCalledWith({ cities: [], districtKeys: ["İzmir::Buca", "İzmir::Bornova"] });
    expect(screen.getByRole("checkbox", { name: "Buca" })).toHaveAttribute("aria-checked", "true");

    // "All" goes back to the whole city.
    await userEvent.click(screen.getByRole("button", { name: "All (2 chosen)" }));
    expect(onChange).toHaveBeenLastCalledWith({ cities: ["İzmir"], districtKeys: [] });
  });

  it("a second city replaces the first, districts and all", async () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);
    await pickCity("İzmir");
    await userEvent.click(screen.getByRole("button", { name: "Districts" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Buca" }));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "City" }));
    await userEvent.click(screen.getByRole("button", { name: "Ankara" }));
    expect(onChange).toHaveBeenLastCalledWith({ cities: ["Ankara"], districtKeys: [] });
    await userEvent.click(screen.getByRole("button", { name: "Districts" }));
    expect(screen.getByRole("checkbox", { name: "Çankaya" })).toBeInTheDocument();
  });
});
