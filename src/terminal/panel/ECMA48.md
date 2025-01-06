# ECMA-48 Control Sequences Implementation Status

This document tracks the implementation status of terminal control sequences based on the ECMA-48 standard, plus common terminal extensions.

## Format Legend

- [x] Implemented
- [ ] Not implemented
- Parameters:
  - Pn: Numeric parameter (defaults to 1 if omitted)
  - Ps: Selective parameter
  - Pt: Text parameter
  - [n]: Optional parameter
  - n;m: Multiple parameters

## Control Sequence Categories

### Basic C0 Control Functions

| Status | Command | Name            | Code | Description                   |
| ------ | ------- | --------------- | ---- | ----------------------------- |
| [X]    | BEL     | Bell            | 0x07 | Audio or visual alert         |
| [X]    | BS      | Backspace       | 0x08 | Move cursor left one position |
| [X]    | HT      | Horizontal Tab  | 0x09 | Move to next tab stop         |
| [X]    | LF      | Line Feed       | 0x0A | Move to next line             |
| [X]    | VT      | Vertical Tab    | 0x0B | Move to next line             |
| [X]    | FF      | Form Feed       | 0x0C | Move to next page             |
| [X]    | CR      | Carriage Return | 0x0D | Move to beginning of line     |
| [X]    | ESC     | Escape          | 0x1B | Start escape sequence         |

### Control String Delimiters

| Status | Command | Name                        | Sequence | Description                      |
| ------ | ------- | --------------------------- | -------- | -------------------------------- |
| [ ]    | APC     | Application Program Command | ESC \_   | Start application command string |
| [ ]    | DCS     | Device Control String       | ESC P    | Start device control string      |
| [ ]    | PM      | Privacy Message             | ESC ^    | Start privacy message string     |
| [ ]    | SOS     | Start of String             | ESC X    | Start string                     |
| [X]    | OSC     | Operating System Command    | ESC ]    | Start operating system command   |
| [ ]    | ST      | String Terminator           | ESC \    | End control string               |

### Additional Control Functions

| Status | Command | Name                               | Type | Parameters | Sequence | Description                        |
| ------ | ------- | ---------------------------------- | ---- | ---------- | -------- | ---------------------------------- |
| [ ]    | BPH     | Break Permitted Here               | ESC  | -          | ESC B    | Indicate possible line break point |
| [ ]    | NBH     | No Break Here                      | ESC  | -          | ESC C    | Prevent line break                 |
| [ ]    | CCH     | Cancel Character                   | ESC  | -          | ESC T    | Cancel previous character          |
| [ ]    | MW      | Message Waiting                    | ESC  | -          | ESC U    | Indicate message waiting           |
| [ ]    | SPA     | Start of Protected Area            | ESC  | -          | ESC V    | Start protected text               |
| [ ]    | EPA     | End of Protected Area              | ESC  | -          | ESC W    | End protected text                 |
| [ ]    | HTJ     | Char Tabulation With Justification | ESC  | -          | ESC I    | Tab with justification             |

### Cursor Control

| Status | Command | Name                           | Type | Parameters  | Sequence  | Description                           |
| ------ | ------- | ------------------------------ | ---- | ----------- | --------- | ------------------------------------- |
| [X]    | CUU     | Cursor Up                      | CSI  | [n]         | CSI n A   | Move cursor up n lines                |
| [X]    | CUD     | Cursor Down                    | CSI  | [n]         | CSI n B   | Move cursor down n lines              |
| [X]    | CUF     | Cursor Forward                 | CSI  | [n]         | CSI n C   | Move cursor forward n columns         |
| [X]    | CUB     | Cursor Backward                | CSI  | [n]         | CSI n D   | Move cursor backward n columns        |
| [X]    | CNL     | Cursor Next Line               | CSI  | [n]         | CSI n E   | Move cursor to start of next line     |
| [X]    | CPL     | Cursor Previous Line           | CSI  | [n]         | CSI n F   | Move cursor to start of previous line |
| [X]    | CHA     | Cursor Horizontal Absolute     | CSI  | n           | CSI n G   | Move cursor to column n               |
| [X]    | CUP     | Cursor Position                | CSI  | [row];[col] | CSI n;m H | Move cursor to position               |
| [X]    | VPA     | Vertical Position Absolute     | CSI  | n           | CSI n d   | Move cursor to row n                  |
| [X]    | SCOSC   | Save Cursor                    | CSI  | -           | CSI s     | Save cursor position                  |
| [X]    | SCORC   | Restore Cursor                 | CSI  | -           | CSI u     | Restore cursor position               |
| [ ]    | HVP     | Horizontal & Vertical Position | CSI  | [row];[col] | CSI n;m f | Move cursor to position               |
| [X]    | CHT     | Cursor Forward Tabulation      | CSI  | [n]         | CSI n I   | Move cursor forward n tab stops       |
| [X]    | CBT     | Cursor Backward Tabulation     | CSI  | [n]         | CSI n Z   | Move cursor backward n tab stops      |
| [ ]    | HPR     | Horizontal Position Relative   | CSI  | [n]         | CSI n a   | Move cursor right n columns           |
| [ ]    | VPR     | Vertical Position Relative     | CSI  | [n]         | CSI n e   | Move cursor down n rows               |

### Character Sets and Designation

| Status | Command | Name                 | Type | Parameters | Sequence | Description                         |
| ------ | ------- | -------------------- | ---- | ---------- | -------- | ----------------------------------- |
| [X]    | SCS     | Select Character Set | ESC  | charset    | ESC (B   | Select default character set        |
| [ ]    | SS2     | Single Shift 2       | ESC  | -          | ESC N    | Temporarily invoke G2 character set |
| [ ]    | SS3     | Single Shift 3       | ESC  | -          | ESC O    | Temporarily invoke G3 character set |

### Editing Control

| Status | Command | Name             | Type | Parameters | Sequence | Description               |
| ------ | ------- | ---------------- | ---- | ---------- | -------- | ------------------------- |
| [X]    | ICH     | Insert Character | CSI  | [n]        | CSI n @  | Insert n blank characters |
| [X]    | DCH     | Delete Character | CSI  | [n]        | CSI n P  | Delete n characters       |
| [X]    | ED      | Erase in Display | CSI  | n          | CSI n J  | Erase screen              |
| [X]    | EL      | Erase in Line    | CSI  | n          | CSI n K  | Erase line                |
| [X]    | IL      | Insert Line      | CSI  | [n]        | CSI n L  | Insert n blank lines      |
| [X]    | DL      | Delete Line      | CSI  | [n]        | CSI n M  | Delete n lines            |
| [X]    | SU      | Scroll Up        | CSI  | [n]        | CSI n S  | Scroll up n lines         |
| [X]    | SD      | Scroll Down      | CSI  | [n]        | CSI n T  | Scroll down n lines       |
| [ ]    | ECH     | Erase Character  | CSI  | [n]        | CSI n X  | Erase n characters        |
| [ ]    | REP     | Repeat           | CSI  | [n]        | CSI n b  | Repeat previous character |

### Area Control

| Status | Command | Name                             | Type | Parameters    | Sequence            | Description                        |
| ------ | ------- | -------------------------------- | ---- | ------------- | ------------------- | ---------------------------------- |
| [ ]    | DECCRA  | Copy Rectangular Area            | CSI  | r;c;h;w;y;x   | CSI r;c;h;w;y;x$v   | Copy rectangular area              |
| [ ]    | DECFRA  | Fill Rectangular Area            | CSI  | c;r1;c1;r2;c2 | CSI c;r1;c1;r2;c2$x | Fill area with character           |
| [ ]    | DECERA  | Erase Rectangular Area           | CSI  | r1;c1;r2;c2   | CSI r1;c1;r2;c2$z   | Erase rectangular area             |
| [ ]    | DECSERA | Selective Erase Rectangular Area | CSI  | r1;c1;r2;c2   | CSI r1;c1;r2;c2${   | Selectively erase rectangular area |
| [ ]    | DAQ     | Define Area Qualification        | CSI  | [n]           | CSI n o             | Define area qualification          |

### Presentation Control

| Status | Command | Name                      | Type | Parameters | Sequence   | Description                |
| ------ | ------- | ------------------------- | ---- | ---------- | ---------- | -------------------------- |
| [ ]    | GSM     | Graphic Size Modification | CSI  | n;m        | CSI n;m B  | Modify character size      |
| [ ]    | FNT     | Font Selection            | CSI  | n          | CSI n SP D | Select font                |
| [ ]    | PLD     | Partial Line Down         | ESC  | -          | ESC K      | Partial line down          |
| [ ]    | PLU     | Partial Line Up           | ESC  | -          | ESC L      | Partial line up            |
| [ ]    | JFY     | Justify                   | CSI  | n          | CSI n F    | Set text justification     |
| [ ]    | SPI     | Spacing Increment         | CSI  | n;m        | CSI n;m G  | Set character spacing      |
| [ ]    | QUAD    | Quad                      | CSI  | n          | CSI n H    | Set quadding/justification |
| [ ]    | SPD     | Select Print Direction    | CSI  | n          | CSI n T    | Set print direction        |

### Text Formatting (SGR)

| Status | Command | Name                     | Type | Parameters | Sequence   | Description         |
| ------ | ------- | ------------------------ | ---- | ---------- | ---------- | ------------------- |
| [X]    | SGR     | Select Graphic Rendition | CSI  | n[;n...]   | CSI n;...m | Set text attributes |

#### Implemented SGR Parameters

| Value   | Effect                         |
| ------- | ------------------------------ |
| 0       | Reset all attributes           |
| 1       | Bold                           |
| 2       | Dim                            |
| 3       | Italic                         |
| 4       | Underline                      |
| 5       | Slow Blink                     |
| 7       | Inverse                        |
| 8       | Hidden                         |
| 9       | Strikethrough                  |
| 21      | Double Underline (or Bold off) |
| 22      | Normal Intensity               |
| 23      | Italic off                     |
| 24      | Underline off                  |
| 25      | Blink off                      |
| 27      | Inverse off                    |
| 28      | Hidden off                     |
| 29      | Strikethrough off              |
| 30-37   | Foreground color               |
| 38      | Set foreground color (256/RGB) |
| 40-47   | Background color               |
| 48      | Set background color (256/RGB) |
| 90-97   | Bright foreground color        |
| 100-107 | Bright background color        |

### Device Status and Control

| Status | Command | Name                   | Type | Parameters | Sequence    | Description                  |
| ------ | ------- | ---------------------- | ---- | ---------- | ----------- | ---------------------------- |
| [X]    | DSR     | Device Status Report   | CSI  | n          | CSI n n     | Request device status        |
| [ ]    | CPR     | Cursor Position Report | CSI  | -          | CSI 6 n     | Report cursor position       |
| [ ]    | MC      | Media Copy             | CSI  | n          | CSI n i     | Control printer              |
| [ ]    | COLM    | Color Modification     | CSI  | n          | CSI n t     | Modify color attributes      |
| [X]    | DECSCNM | Screen Mode            | CSI  | -          | CSI ? 5 h/l | Set/reset reverse video mode |

### Tabs

| Status | Command | Name               | Type | Parameters | Sequence | Description                      |
| ------ | ------- | ------------------ | ---- | ---------- | -------- | -------------------------------- |
| [ ]    | HTS     | Horizontal Tab Set | ESC  | -          | ESC H    | Set tab stop at current position |
| [ ]    | TBC     | Tab Clear          | CSI  | n          | CSI g    | Clear tab stop(s)                |

### Control Functions

| Status | Command | Name                      | Type | Parameters | Sequence | Description                      |
| ------ | ------- | ------------------------- | ---- | ---------- | -------- | -------------------------------- |
| [X]    | NEL     | Next Line                 | ESC  | -          | ESC E    | Move to next line                |
| [X]    | HTS     | Horizontal Tabulation Set | ESC  | -          | ESC H    | Set tab stop                     |
| [X]    | RI      | Reverse Index             | ESC  | -          | ESC M    | Move up one line                 |
| [ ]    | DA      | Device Attributes         | CSI  | [n]        | CSI c    | Request/report device attributes |
| [X]    | IND     | Index                     | ESC  | -          | ESC D    | Move down one line               |

### Mode Settings

| Status | Command | Name       | Type | Parameters | Sequence   | Description |
| ------ | ------- | ---------- | ---- | ---------- | ---------- | ----------- |
| [X]    | SM      | Set Mode   | CSI  | n[;n...]   | CSI n;...h | Set mode    |
| [X]    | RM      | Reset Mode | CSI  | n[;n...]   | CSI n;...l | Reset mode  |

#### Standard Mode Parameters (ANSI)

| Value | Mode     | Description             |
| ----- | -------- | ----------------------- |
| 2     | KAM      | Keyboard Action Mode    |
| 4     | IRM      | Insert Mode             |
| 12    | SRM      | Send/Receive Mode       |
| 20    | LNM      | Line Feed/New Line Mode |
| 33    | WYSTCURM | Steady Cursor Mode      |
| 34    | WYULCURM | Underlining Cursor Mode |

#### Implemented Mode Parameters

| Value | Mode | Description             |
| ----- | ---- | ----------------------- |
| 4     | IRM  | Insert Mode             |
| 20    | LNM  | Line Feed/New Line Mode |

### DEC Private Modes

| Status | Command       | Name                    | Parameters | Sequence   | Description                    |
| ------ | ------------- | ----------------------- | ---------- | ---------- | ------------------------------ |
| [X]    | DECSET/DECRST | Set/Reset Private Mode  | n          | CSI ?n h/l | Set or reset private mode      |
| [X]    | DECKPAM       | Keypad Application Mode | -          | ESC =      | Enable keypad application mode |
| [X]    | DECKPNM       | Keypad Numeric Mode     | -          | ESC >      | Enable keypad numeric mode     |
| [X]    | DECSC         | Save Cursor             | -          | ESC 7      | Save cursor state              |
| [X]    | DECRC         | Restore Cursor          | -          | ESC 8      | Restore cursor state           |

#### Implemented Private Mode Parameters

| Value | Mode   | Description             |
| ----- | ------ | ----------------------- |
| 1     | DECCKM | Application Cursor Keys |
| 6     | DECOM  | Origin Mode             |
| 7     | DECAWM | Auto Wrap Mode          |
| 66    | DECNKM | Application Keypad Mode |
| 1000  | -      | Mouse Click Tracking    |
| 1002  | -      | Mouse Button Events     |
| 1003  | -      | Mouse Any Event         |
| 2004  | -      | Bracketed Paste Mode    |

### Operating System Commands (OSC)

| Status | Command                        | Parameters | Sequence     | Description                         |
| ------ | ------------------------------ | ---------- | ------------ | ----------------------------------- |
| [X]    | Set Icon Name and Window Title | 0;txt      | OSC 0;txt ST | Set both icon name and window title |
| [X]    | Set Window Title               | 2;txt      | OSC 2;txt ST | Set window title                    |
| [X]    | Set Icon Name                  | 1;txt      | OSC 1;txt ST | Set icon name                       |
| [X]    | Set Current Directory          | 7;txt      | OSC 7;txt ST | Set current working directory       |

## Color Control Extensions

| Status | Command | Name                  | Parameters | Sequence    | Description               |
| ------ | ------- | --------------------- | ---------- | ----------- | ------------------------- |
| [ ]    | COLM    | Color Modification    | n          | CSI n t     | Modify color attributes   |
| [ ]    | DECSCNM | Screen Mode (reverse) | -          | CSI ? 5 h/l | Toggle reverse video mode |

### Numeric Parameters (Pn)

- Default to 1 if omitted unless otherwise specified
- Valid range: 0-9999
- Leading zeros are ignored
- Parameters outside the valid range should be clamped or ignored

### Selective Parameters (Ps)

- No default value unless specified
- Must match one of the defined values for the command
- Invalid values should be ignored

### Multiple Parameters

- Separated by semicolons
- Empty parameters between semicolons take the default value
- Trailing semicolons are ignored
- Maximum of 16 parameters per sequence

## Notes

- CSI sequences start with `ESC [` (or byte 0x9B)
- OSC sequences start with `ESC ]` (or byte 0x9D)
- ST (String Terminator) is `ESC \` (or byte 0x9C)
- DEC private modes use the `?` modifier before the parameter
- All numeric parameters default to 1 if omitted unless otherwise specified
- Multiple parameters are separated by semicolons
- Some terminals may support additional vendor-specific extensions not listed here
- C0 controls (0x00-0x1F) and DELETE (0x7F) have immediate effect when received
- Control strings (APC, DCS, OSC, PM, SOS) must be terminated with ST
- Malformed or incomplete sequences should be ignored
- Unknown escape sequences should be ignored
- Character set support requires at least ASCII (ISO-646) and ISO 8859-1
