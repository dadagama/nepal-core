import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig( {
    plugins: [
        tsconfigPaths( {
            projects: [ "./tsconfig.spec.json" ]
        } )
    ],
    globals: true,
    environment: 'jsdom',
    coverage: {
        enabled: true,
        provider: 'v8',
        reporter: "json-summary"
    }
} );
