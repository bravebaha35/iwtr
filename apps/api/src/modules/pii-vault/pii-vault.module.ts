import { Module } from "@nestjs/common";
import { PiiVaultService } from "./pii-vault.service";

@Module({
  providers: [PiiVaultService],
  exports: [PiiVaultService],
})
export class PiiVaultModule {}
