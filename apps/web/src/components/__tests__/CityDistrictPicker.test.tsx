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

describe("CityDistrictPicker", () => {
  it("picks one city, then narrows to that city's districts only", async () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.type(screen.getByRole("combobox", { name: "Choose a city" }), "izmir");
    await userEvent.click(screen.getByRole("option", { name: "İzmir" }));
    expect(onChange).toHaveBeenLastCalledWith({ cities: ["İzmir"], districtKeys: [] });

    // Only İzmir's districts are offered now, with "All of İzmir" on.
    expect(screen.getByRole("button", { name: "All of İzmir" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Çankaya" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Buca" }));
    await userEvent.click(screen.getByRole("button", { name: "Bornova" }));
    expect(onChange).toHaveBeenLastCalledWith({ cities: [], districtKeys: ["İzmir::Buca", "İzmir::Bornova"] });

    // Unticking the last district goes back to the whole city.
    await userEvent.click(screen.getByRole("button", { name: "Buca" }));
    await userEvent.click(screen.getByRole("button", { name: "Bornova" }));
    expect(onChange).toHaveBeenLastCalledWith({ cities: ["İzmir"], districtKeys: [] });
  });

  it("finds a district by name from the city box", async () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.type(screen.getByRole("combobox", { name: "Choose a city" }), "buca");
    await userEvent.click(screen.getByRole("option", { name: /Buca.*İzmir/ }));
    expect(onChange).toHaveBeenLastCalledWith({ cities: [], districtKeys: ["İzmir::Buca"] });
  });

  it("swaps to another city with the X", async () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.type(screen.getByRole("combobox", { name: "Choose a city" }), "ankara");
    await userEvent.click(screen.getByRole("option", { name: "Ankara" }));
    await userEvent.click(screen.getByRole("button", { name: "Choose another city" }));
    expect(screen.getByRole("combobox", { name: "Choose a city" })).toBeInTheDocument();
  });
});
