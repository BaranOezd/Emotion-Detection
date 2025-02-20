"use client";

import React from "react";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, LabelList } from "recharts";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

// Emotion color mapping (update if needed)
const emotionColors = {
  Joy: "#FFEB3B",
  Sadness: "#2196F3",
  Fear: "#9C27B0",
  Disgust: "#4CAF50",
  Anger: "#F44336",
  Surprise: "#FFB322",
  Neutral: "#9E9E9E",
};

export function EmotionBarChart({ selectedSentence }) {
  // If no sentence is selected, do not render the chart.
  if (!selectedSentence) return null;

  // Compute emotions from the selected sentence object.
  // Expecting the object shape: { Sentence: "text", Joy: "0.5", Sadness: "0.2", ... }
  const emotions = Object.keys(selectedSentence).filter((key) => key !== "Sentence");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Emotion Analysis</CardTitle>
        <CardDescription>{selectedSentence.Sentence}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer>
          <BarChart
            data={[selectedSentence]} // Wrap the object in an array for Recharts
            margin={{ top: 20, right: 30, left: 50, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            {/* We hide the X-axis as it is not needed (it could be used for labeling if desired) */}
            <XAxis dataKey="Sentence" hide />
            <YAxis domain={[0, 1]} tickFormatter={(d) => `${Math.round(d * 100)}%`} />
            <Tooltip content={<ChartTooltipContent />} />
            {/* Render one Bar per emotion */}
            {emotions.map((emotion) => (
              <Bar
                key={emotion}
                dataKey={emotion}
                fill={emotionColors[emotion]}
                radius={8}
              >
                <LabelList
                  dataKey={emotion}
                  position="top"
                  offset={12}
                  fontSize={12}
                  formatter={(value) => `${Math.round(value * 100)}%`}
                />
              </Bar>
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div>Emotion analysis for the selected sentence.</div>
      </CardFooter>
    </Card>
  );
}
