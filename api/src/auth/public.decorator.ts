import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC = 'isPublic';
/** Opt-OUT of authentication. Auth is the default: forgetting a decorator fails closed (401). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
