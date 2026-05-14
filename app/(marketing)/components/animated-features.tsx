"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Code, Database, Lock } from "lucide-react";
import { motion } from "framer-motion";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 }
  }
};

export default function AnimatedFeatures() {
  return (
    <>
      <motion.div
        className="text-center mb-16"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Powerful Features</h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Everything you need to build and scale your projects
        </p>
      </motion.div>

      <motion.div 
        className="grid grid-cols-1 md:grid-cols-3 gap-8"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <div className="bg-primary/10 p-3 rounded-lg w-fit mb-4">
                <Code className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Modern Stack</CardTitle>
              <CardDescription>Built with Next.js, Tailwind CSS, and ShadCN UI</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {["Server components", "Type safety", "Fast rendering"].map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <div className="bg-primary/10 p-3 rounded-lg w-fit mb-4">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Robust Backend</CardTitle>
              <CardDescription>Supabase and Drizzle integration for seamless data management</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {["SQL queries", "Data validation", "Real-time updates"].map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <div className="bg-primary/10 p-3 rounded-lg w-fit mb-4">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Secure Authentication</CardTitle>
              <CardDescription>Clerk authentication with flexible options</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {["Social logins", "Role-based access", "OAuth integration"].map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </>
  );
} 