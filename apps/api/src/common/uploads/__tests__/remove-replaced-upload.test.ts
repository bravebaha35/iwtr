import { unlink } from "fs/promises";
import { join } from "path";
import { removeReplacedUpload } from "../remove-replaced-upload";

jest.mock("fs/promises", () => ({ unlink: jest.fn().mockResolvedValue(undefined) }));

const OLD = "http://localhost:3001/uploads/company-logos/0886917e-a03c-4e6d-8013-5eaad6b5cf0d.png";
const unused = jest.fn().mockResolvedValue(false);

beforeEach(() => jest.clearAllMocks());

describe("removeReplacedUpload", () => {
  it("deletes our own old file once nothing points at it", async () => {
    await removeReplacedUpload(OLD, "http://localhost:3001/uploads/company-logos/new.png", "company-logos", unused);
    expect(unlink).toHaveBeenCalledWith(join(process.cwd(), "uploads", "company-logos", "0886917e-a03c-4e6d-8013-5eaad6b5cf0d.png"));
  });

  it("keeps it when unchanged, still used, foreign, or in another folder", async () => {
    await removeReplacedUpload(OLD, OLD, "company-logos", unused);
    await removeReplacedUpload(OLD, null, "company-logos", jest.fn().mockResolvedValue(true));
    await removeReplacedUpload("https://example.com/logo.png", null, "company-logos", unused);
    await removeReplacedUpload(OLD, null, "company-banners", unused);
    expect(unlink).not.toHaveBeenCalled();
  });

  it("never follows a name it did not write itself", async () => {
    await removeReplacedUpload("http://x/uploads/company-logos/../../.env", null, "company-logos", unused);
    await removeReplacedUpload("http://x/uploads/company-logos/iworkedthere.svg", null, "company-logos", unused);
    expect(unlink).not.toHaveBeenCalled();
  });

  it("a failed delete never fails the save", async () => {
    (unlink as jest.Mock).mockRejectedValueOnce(new Error("ENOENT"));
    await expect(removeReplacedUpload(OLD, null, "company-logos", unused)).resolves.toBeUndefined();
  });
});
