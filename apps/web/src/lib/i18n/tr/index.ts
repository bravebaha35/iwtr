import type { Dictionary } from "../core";
import common from "./common";
import home from "./home";
import jobs from "./jobs";
import company from "./company";
import social from "./social";
import messaging from "./messaging";
import profile from "./profile";
import owner from "./owner";
import auth from "./auth";
import countries from "./countries";
import cv from "./cv";
import survey from "./survey";
import flags from "./flags";
import usernames from "./usernames";
import perks from "./perks";

// The whole Turkish dictionary. Split by area only to keep each file a
// readable size; one English text has one Turkish wording site-wide, so a
// later area never needs to repeat a key an earlier one already has.
//
// Wording follows Turkish job-site usage (Kariyer.net and the like): "iş
// ilanı", "başvur", "pozisyon seviyesi", "mavi yaka", and the informal-polite
// "sen" register of a consumer site rather than formal "siz" letters.
export const TR: Dictionary = Object.freeze({
  ...common,
  ...home,
  ...jobs,
  ...company,
  ...social,
  ...messaging,
  ...profile,
  ...owner,
  ...auth,
  ...countries,
  ...cv,
  ...survey,
  ...flags,
  ...usernames,
  ...perks,
});
