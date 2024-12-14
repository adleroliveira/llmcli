import { Cursor, Erase, SequenceBuilder } from "../builder/index.js";

export const clear = SequenceBuilder.create()
  .add(Erase.display())
  .add(Cursor.moveTo({ row: 0, column: 0 }))
  .add(Cursor.hide())
  .build();
