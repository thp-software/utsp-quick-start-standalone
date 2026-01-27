# UTSP Quick Start - Standalone

A minimal starter project to learn **UTSP** (Universal Text Streaming Protocol) in standalone mode.

## What is Standalone Mode?

Standalone mode runs your UTSP application directly in the browser without needing a server. It's perfect for:
- Learning UTSP concepts
- Prototyping games locally
- Single-player experiences

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)

### Installation

```bash
npm i
```

### Development

```bash
npm run dev
```

Then open your browser at the URL shown in the terminal (usually `http://localhost:5173`).

## Project Structure

```
src/
├── App.tsx                 # Main React app
├── components/
│   └── utsp-client/
│       └── UTSPClient.tsx  # React wrapper for UTSP runtime
└── applications/
    └── SpaceDemo.ts        # Example UTSP game application
```

## Next Steps

1. Open `src/applications/SpaceDemo.ts` to see how a UTSP application works
2. Modify the game logic and see changes instantly (HMR enabled)
3. Create your own application by implementing the `IApplication` interface

## Learn More

- [UTSP Documentation](https://docs.utsp.dev/)
