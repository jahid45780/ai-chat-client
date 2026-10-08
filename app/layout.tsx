import type {Metadata} from 'next';import './globals.css';import './broken-ai.css';import {AuthProvider} from '@/hooks/useAuth';import {ThemeProvider} from '@/components/ui/ThemeProvider';
export const metadata:Metadata={title:'BROKEN AI — Think Beyond the Ordinary',description:'A thoughtful AI workspace for writing, coding, learning, and exploring ideas.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><body><ThemeProvider><AuthProvider>{children}</AuthProvider></ThemeProvider></body></html>}
