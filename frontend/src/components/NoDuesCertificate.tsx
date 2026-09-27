'use client';

import React from 'react';

export interface NoDuesCertificateProps {
  studentName: string;
  usn: string;
  department: string;
  year?: string;
  date: string;
  signatureUrl?: string | null;
}

export default function NoDuesCertificate({
  studentName,
  usn,
  department,
  year,
  date,
  signatureUrl,
}: NoDuesCertificateProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="noc-container" className="bg-white text-black p-5 sm:p-10 md:p-12 max-w-3xl mx-auto shadow-2xl relative font-serif text-xs sm:text-sm leading-relaxed border border-gray-200">
      
      {/* Print Button (Hidden in Print View) */}
      <div className="flex justify-end mb-6 print:hidden">
        <button 
          onClick={handlePrint}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-sans text-xs font-bold px-4 py-2 rounded-lg shadow-lg transition-colors flex items-center gap-2 active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          Print Certificate
        </button>
      </div>

      {/* College Header */}
      <div className="text-center border-b-2 border-black pb-4 sm:pb-6 mb-6 sm:mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/college_header.png" alt="Vidyavardhaka College of Engineering" className="w-full h-auto" />
      </div>

      {/* Certificate Title */}
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold uppercase underline decoration-2 underline-offset-4">No Dues Certificate</h2>
      </div>

      {/* Letter Body */}
      <div className="space-y-6 px-4">
        <div className="text-right mb-6">
          <p><strong>Date:</strong> {date}</p>
        </div>

        <p className="text-justify leading-loose text-base">
          This is to certify that <strong>Mr./Ms. {studentName}</strong>, bearing USN <strong>{usn}</strong>, 
          a student of the <strong>Department of {department}</strong>
          {year ? ` in their ${year} year` : ''}, has successfully returned all laboratory components, tools, 
          and equipment borrowed from the Department Laboratory.
        </p>
        
        <p className="text-justify leading-loose text-base">
          We confirm that there are <strong>NO DUES</strong> pending against the aforementioned student concerning the lab inventory. 
          This certificate is issued upon the request of the student for their academic/administrative clearance.
        </p>

        {/* Signatures */}
        <div className="flex justify-between items-end mt-24 mb-8">
          <div className="text-left flex flex-col items-center">
            <div className="h-16 flex items-center justify-center font-serif italic text-2xl text-blue-800 mix-blend-multiply">
              Verified
            </div>
            <p className="font-bold border-t-2 border-black pt-1 mt-2 inline-block px-4">Lab Administrator</p>
          </div>
          
          <div className="text-right flex flex-col items-center">
            <div className="h-16 flex items-center justify-center font-serif italic text-2xl text-blue-800 mix-blend-multiply">
              Approved
            </div>
            <p className="font-bold border-t-2 border-black pt-1 mt-2 inline-block px-4">Head of Department</p>
          </div>
        </div>

        {/* Digital Document Notice */}
        <div className="pt-12 pb-4 text-center">
          <div className="inline-block border-2 border-gray-400 text-gray-500 rounded px-6 py-3 bg-gray-50">
            <p className="font-bold uppercase tracking-widest text-xs mb-1">System Generated Certificate</p>
            <p className="text-xs">This document is electronically verified based on the lab inventory system records.</p>
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #noc-container, #noc-container * {
            visibility: visible;
          }
          #noc-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
            box-shadow: none;
            border: none;
          }
        }
      `}} />
    </div>
  );
}
