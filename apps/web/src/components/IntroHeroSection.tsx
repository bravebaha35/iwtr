"use client";

import { useState } from "react";
import type { WorkplaceType } from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { AdSlot } from "@/components/AdSlot";
import { CompanySearch } from "@/components/CompanySearch";
import { IntroLocationPicker } from "@/components/IntroLocationPicker";
import { MultiFilterPillGroup } from "@/components/FilterPillGroup";
import { WebsiteRulesModal } from "@/components/WebsiteRulesModal";
import { WORKPLACE_TYPES } from "@/lib/workplaceTypes";
import { collarPillClassName } from "@/lib/collarColors";

type NearMeState = "idle" | "loading" | "granted" | "denied";

// Landing-page hero above the fold. Search/location/work-type here are a
// self-contained preview with their own local state — deliberately NOT
// wired to WorkplaceBrowser's filters further down the page (CompanySearch's
// own result links, and clicking through to a company page, are the only
// functional outcome). Colors are the site's shared theme tokens
// (bg-background/bg-surface/border-border/etc.), so this banner follows the
// same light/dark toggle as the rest of the app rather than a fixed palette.
export function IntroHeroSection() {
  const { openAuthModal } = useAuth();
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedDistrictKeys, setSelectedDistrictKeys] = useState<string[]>([]);
  const [workplaceTypes, setWorkplaceTypes] = useState<WorkplaceType[]>([]);
  const [nearMe, setNearMe] = useState<NearMeState>("idle");
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  // Swaps the contributor illustration to the "found" pose on hover/focus —
  // the "thinking" pose (dusunenkunduz) is the resting state; moving the
  // cursor onto it (or tabbing to it) reveals bulankunduz as a hint that
  // it's the same clickable CTA the old VisitorHeroSection banner used to be.
  const [contributorHovered, setContributorHovered] = useState(false);

  function toggleCity(city: string) {
    setSelectedCities((prev) => (prev.includes(city) ? [] : [city]));
  }

  function toggleDistrict(key: string) {
    setSelectedDistrictKeys((prev) => (prev.includes(key) ? prev.filter((v) => v !== key) : [...prev, key]));
  }

  // Mirrors WorkplaceBrowser's "at most 2 workplace types" rule (see
  // CLAUDE.md) so this preview behaves identically to the real filter.
  function toggleWorkplaceType(value: WorkplaceType) {
    setWorkplaceTypes((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      if (prev.length >= 2) return [value];
      return [...prev, value];
    });
  }

  function resetWorkplaceTypes() {
    setWorkplaceTypes([]);
  }

  function requestNearMe() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setNearMe("denied");
      return;
    }
    setNearMe("loading");
    navigator.geolocation.getCurrentPosition(
      () => setNearMe("granted"),
      () => setNearMe("denied"),
      { timeout: 8000 },
    );
  }

  return (
    <section className="w-full bg-background py-10 font-sans">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4">
        <AdSlot orientation="horizontal" />

        <div className="w-full p-8 md:p-12">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
            {/* Full-width search bar above the rest of the grid */}
            <div className="md:col-span-2">
              <CompanySearch size="lg" />
            </div>

            {/* Location + work-type */}
            <div className="flex flex-col gap-4">
              <IntroLocationPicker
                selectedCities={selectedCities}
                selectedDistrictKeys={selectedDistrictKeys}
                onToggleCity={toggleCity}
                onToggleDistrict={toggleDistrict}
                onNearMe={requestNearMe}
                nearMeLoading={nearMe === "loading"}
                nearMeActive={nearMe === "granted"}
              />
              <div className="mx-auto w-fit">
                <MultiFilterPillGroup
                  heading="Work-Type"
                  options={WORKPLACE_TYPES}
                  selected={workplaceTypes}
                  onToggle={toggleWorkplaceType}
                  onReset={resetWorkplaceTypes}
                  direction="wrap"
                  pillColorClassName={collarPillClassName}
                  showHeading={false}
                />
              </div>
            </div>

            {/* Primary CTA text */}
            <div className="flex items-center">
              <p className="text-3xl font-bold text-foreground md:text-4xl">
                You are looking for a job and don&apos;t know how to choose? Search it up, see what their real
                employees say !
              </p>
            </div>

            {/* Secondary CTA text + contributor CTA (merged in from the old
                VisitorHeroSection banner, which used to sit between the ad
                rail and the company browser) */}
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-lg font-bold text-foreground md:text-xl">
                  All kind of employees welcomed here. Search your work-type and location from here to see how they
                  doing ! Already working or worked somewhere ?
                </p>
                <p className="mt-2 text-base font-light text-foreground md:text-lg">
                  Share your experience! Register for free so other candidates can see your experience with 100%
                  anonymity - click beaver to see how our website works!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRulesModalOpen(true)}
                onMouseEnter={() => setContributorHovered(true)}
                onMouseLeave={() => setContributorHovered(false)}
                onFocus={() => setContributorHovered(true)}
                onBlur={() => setContributorHovered(false)}
                aria-label="Already working or worked somewhere? Share your experience."
                className="h-40 w-40 shrink-0 md:h-48 md:w-48"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- public/ asset referenced by path, not a static import */}
                <img
                  src={contributorHovered ? "/bulankunduz.png" : "/dusunenkunduz.png"}
                  alt="Already working or worked somewhere? Share your experience."
                  className="h-full w-full object-contain"
                />
              </button>
            </div>

            {/* Visual graphic */}
            <div className="flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- public/ asset referenced by path, not a static import */}
              <img
                src="/IWT%20Intro%20Real.png"
                alt="I Worked There"
                className="h-auto w-full max-w-lg object-contain"
              />
            </div>
          </div>
        </div>

        <AdSlot orientation="horizontal" />
      </div>

      {rulesModalOpen && (
        <WebsiteRulesModal
          onClose={() => setRulesModalOpen(false)}
          onRegister={() => {
            setRulesModalOpen(false);
            openAuthModal("register");
          }}
        />
      )}
    </section>
  );
}
