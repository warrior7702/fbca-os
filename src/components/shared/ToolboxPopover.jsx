import React, { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wrench, Dices, Calculator, Calendar, Copy, Delete } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, getDay } from "date-fns";

// US Federal Holidays 2024-2025
const US_HOLIDAYS = {
  '2024-01-01': "New Year's Day",
  '2024-01-15': 'MLK Jr. Day',
  '2024-02-19': "Presidents' Day",
  '2024-05-27': 'Memorial Day',
  '2024-06-19': 'Juneteenth',
  '2024-07-04': 'Independence Day',
  '2024-09-02': 'Labor Day',
  '2024-10-14': 'Columbus Day',
  '2024-11-11': 'Veterans Day',
  '2024-11-28': 'Thanksgiving',
  '2024-12-25': 'Christmas Day',
  '2025-01-01': "New Year's Day",
  '2025-01-20': 'MLK Jr. Day',
  '2025-02-17': "Presidents' Day",
  '2025-05-26': 'Memorial Day',
  '2025-06-19': 'Juneteenth',
  '2025-07-04': 'Independence Day',
  '2025-09-01': 'Labor Day',
  '2025-10-13': 'Columbus Day',
  '2025-11-11': 'Veterans Day',
  '2025-11-27': 'Thanksgiving',
  '2025-12-25': 'Christmas Day',
};

export default function ToolboxPopover() {
  const [randomNumber, setRandomNumber] = useState('------');
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcExpression, setCalcExpression] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isOpen, setIsOpen] = useState(false);

  // Random Number Generator
  const generateRandomNumber = () => {
    const num = Math.floor(100000 + Math.random() * 900000).toString();
    setRandomNumber(num);
  };

  const copyNumber = () => {
    if (randomNumber !== '------') {
      navigator.clipboard.writeText(randomNumber);
      toast.success('Copied to clipboard');
    }
  };

  // Calculator
  const handleCalcInput = (value) => {
    if (calcDisplay === '0' && !isNaN(value)) {
      setCalcDisplay(value);
      setCalcExpression(value);
    } else if (calcDisplay === 'Error') {
      setCalcDisplay(value);
      setCalcExpression(value);
    } else {
      setCalcDisplay(calcDisplay + value);
      setCalcExpression(calcExpression + value);
    }
  };

  const handleOperator = (op) => {
    const lastChar = calcExpression.slice(-1);
    if (['+', '-', '*', '/'].includes(lastChar)) {
      setCalcExpression(calcExpression.slice(0, -1) + op);
      setCalcDisplay(calcDisplay.slice(0, -1) + op);
    } else {
      setCalcExpression(calcExpression + op);
      setCalcDisplay(calcDisplay + op);
    }
  };

  const calculateResult = () => {
    try {
      const result = eval(calcExpression);
      setCalcDisplay(String(result));
      setCalcExpression(String(result));
    } catch {
      setCalcDisplay('Error');
      setCalcExpression('');
    }
  };

  const clearCalc = () => {
    setCalcDisplay('0');
    setCalcExpression('');
  };

  // Calendar
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = getDay(monthStart);

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10">
          <Wrench className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 mb-2" align="center">
        <Tabs defaultValue="random" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-3">
            <TabsTrigger value="random" className="text-xs">
              <Dices className="w-3 h-3 mr-1" />
              Random
            </TabsTrigger>
            <TabsTrigger value="calc" className="text-xs">
              <Calculator className="w-3 h-3 mr-1" />
              Calc
            </TabsTrigger>
            <TabsTrigger value="calendar" className="text-xs">
              <Calendar className="w-3 h-3 mr-1" />
              Calendar
            </TabsTrigger>
          </TabsList>

          {/* Random Number Generator */}
          <TabsContent value="random" className="space-y-3">
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-2">6-Digit Random Number</p>
              <div className="flex items-center justify-center gap-2">
                <div className="text-3xl font-mono font-bold tracking-widest text-slate-900 bg-slate-100 px-4 py-2 rounded-lg">
                  {randomNumber}
                </div>
                <Button variant="ghost" size="icon" onClick={copyNumber} disabled={randomNumber === '------'}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <Button onClick={generateRandomNumber} className="mt-3 w-full bg-violet-600 hover:bg-violet-700">
                <Dices className="w-4 h-4 mr-2" />
                Generate
              </Button>
            </div>
          </TabsContent>

          {/* Calculator */}
          <TabsContent value="calc" className="space-y-2">
            <div className="bg-slate-900 text-white text-right p-3 rounded-lg font-mono text-xl overflow-x-auto">
              {calcDisplay}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {['7', '8', '9', '/'].map(btn => (
                <Button
                  key={btn}
                  variant={isNaN(btn) ? "secondary" : "outline"}
                  className="h-10"
                  onClick={() => isNaN(btn) ? handleOperator(btn) : handleCalcInput(btn)}
                >
                  {btn}
                </Button>
              ))}
              {['4', '5', '6', '*'].map(btn => (
                <Button
                  key={btn}
                  variant={isNaN(btn) ? "secondary" : "outline"}
                  className="h-10"
                  onClick={() => isNaN(btn) ? handleOperator(btn) : handleCalcInput(btn)}
                >
                  {btn === '*' ? '×' : btn}
                </Button>
              ))}
              {['1', '2', '3', '-'].map(btn => (
                <Button
                  key={btn}
                  variant={isNaN(btn) ? "secondary" : "outline"}
                  className="h-10"
                  onClick={() => isNaN(btn) ? handleOperator(btn) : handleCalcInput(btn)}
                >
                  {btn}
                </Button>
              ))}
              <Button variant="outline" className="h-10" onClick={() => handleCalcInput('0')}>0</Button>
              <Button variant="outline" className="h-10" onClick={() => handleCalcInput('.')}>.</Button>
              <Button variant="destructive" className="h-10" onClick={clearCalc}>C</Button>
              <Button variant="secondary" className="h-10" onClick={() => handleOperator('+')}>+</Button>
              <Button className="col-span-4 h-10 bg-violet-600 hover:bg-violet-700" onClick={calculateResult}>=</Button>
            </div>
          </TabsContent>

          {/* Calendar with Holidays */}
          <TabsContent value="calendar" className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <Button variant="ghost" size="sm" onClick={prevMonth}>←</Button>
              <span className="font-semibold text-sm">{format(currentMonth, 'MMMM yyyy')}</span>
              <Button variant="ghost" size="sm" onClick={nextMonth}>→</Button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div key={d} className="font-semibold text-slate-500 py-1">{d}</div>
              ))}
              {Array(startDay).fill(null).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const holiday = US_HOLIDAYS[dateStr];
                const isHoliday = !!holiday;
                return (
                  <div
                    key={dateStr}
                    className={`py-1 rounded text-xs cursor-default ${
                      isToday(day) ? 'bg-violet-600 text-white font-bold' :
                      isHoliday ? 'bg-red-100 text-red-700 font-semibold' : ''
                    }`}
                    title={holiday || ''}
                  >
                    {format(day, 'd')}
                  </div>
                );
              })}
            </div>
            {/* Show holidays this month */}
            <div className="mt-2 space-y-1 max-h-20 overflow-y-auto">
              {days.filter(d => US_HOLIDAYS[format(d, 'yyyy-MM-dd')]).map(d => (
                <div key={format(d, 'yyyy-MM-dd')} className="text-xs flex items-center gap-2 text-red-700">
                  <span className="font-semibold">{format(d, 'MMM d')}:</span>
                  <span>{US_HOLIDAYS[format(d, 'yyyy-MM-dd')]}</span>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}