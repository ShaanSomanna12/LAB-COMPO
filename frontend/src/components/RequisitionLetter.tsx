'use client';

import React from 'react';

interface RequisitionItem {
  name: string;
  quantity: number;
}

export interface RequisitionLetterProps {
  studentName: string;
  usn: string;
  department: string;
  items: RequisitionItem[];
  requestDate: string;
  duration: number; // in days
  status: string;
  section?: string;
  year?: string;
  mobile?: string;
  returnDate?: string;
  signatureUrl?: string;
  projectTitle?: string;
  projectType?: string;
  projectPurpose?: string;
  hackathonDate?: string;
  hackathonVenue?: string;
  teamMembers?: { name: string; usn: string }[];
}

export default function RequisitionLetter({
  studentName,
  usn,
  department,
  items,
  requestDate,
  duration,
  status,
  section,
  year,
  mobile,
  returnDate: explicitReturnDate,
  signatureUrl,
  projectTitle,
  projectType,
  projectPurpose,
  hackathonDate,
  hackathonVenue,
  teamMembers
}: RequisitionLetterProps) {
  
  const handlePrint = () => {
    window.print();
  };

  const calculatedReturnDate = new Date(new Date(requestDate).getTime() + duration * 24 * 60 * 60 * 1000).toLocaleDateString();
  const displayReturnDate = explicitReturnDate ? new Date(explicitReturnDate).toLocaleDateString() : calculatedReturnDate;
  const formattedRequestDate = new Date(requestDate).toLocaleDateString();
  
  const isApproved = ['APPROVED', 'CHECKED_OUT', 'READY_FOR_PICKUP', 'RETURN_REQUESTED', 'RETURNED'].includes(status);
  const displayStatus = isApproved ? 'APPROVED' : 'PENDING';

  return (
    <div id="letter-container" className="bg-white text-black p-5 sm:p-10 md:p-12 max-w-3xl mx-auto shadow-2xl relative font-serif text-xs sm:text-sm leading-relaxed border border-gray-200">
      
      {/* Print Button (Hidden in Print View) */}
      <div className="flex justify-end mb-6 print:hidden">
        <button 
          onClick={handlePrint}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-sans text-xs font-bold px-4 py-2 rounded-lg shadow-lg transition-colors flex items-center gap-2 active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          Print Letter
        </button>
      </div>

      {/* College Header */}
      <div className="text-center border-b-2 border-black pb-4 sm:pb-6 mb-6 sm:mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/college_header.png" alt="Vidyavardhaka College of Engineering" className="w-full h-auto" />
      </div>

      {/* Letter Body */}
      <div className="space-y-6">
        
        {/* Date and To */}
        <div className="flex justify-between items-start">
          <div>
            <p><strong>To,</strong></p>
            <p>The Faculty Coordinator,</p>
            <p>Department of {department},</p>
            <p>VVCE, Mysuru.</p>
          </div>
          <div className="text-right">
            <p><strong>Date:</strong> {formattedRequestDate}</p>
            <p><strong>Status:</strong> <span className={`font-bold ${displayStatus === 'APPROVED' ? 'text-green-600' : 'text-gray-700'}`}>{displayStatus}</span></p>
          </div>
        </div>

        {/* Subject and Salutation */}
        <div>
          <p><strong>Subject:</strong> Requisition for borrowing laboratory components for {projectType ? projectType.toLowerCase() : 'academic project'}{projectTitle ? ` - ${projectTitle}` : ''}.</p>
          <br/>
          <p>Respected Sir/Madam,</p>
          <p className="mt-2 text-justify">
            I, <strong>{studentName}</strong>, bearing USN <strong>{usn}</strong>{mobile ? ` (Mobile: ${mobile})` : ''}, am currently pursuing my studies in the Department of {department}{section ? `, Section ${section}` : ''}{year ? `, in my ${year} of engineering` : ''}. 
            I am writing to formally request the temporary issuance of the following laboratory components required for the execution of my {projectType ? projectType.toLowerCase() : 'academic project/assignment'}.
          </p>
          {projectPurpose && (
            <p className="mt-3 text-justify">
              <strong>Purpose:</strong> {projectPurpose}
            </p>
          )}
          {(hackathonDate || hackathonVenue) && (
            <p className="mt-2 text-justify">
              <strong>Hackathon Details:</strong> <strong>{hackathonDate ? `Scheduled on ${new Date(hackathonDate).toLocaleDateString()}` : ''}{hackathonDate && hackathonVenue ? ' at ' : ''}{hackathonVenue ? hackathonVenue : ''}</strong>
            </p>
          )}
          {teamMembers && teamMembers.length > 0 && (
            <div className="mt-4">
              <p className="font-semibold mb-1">This project is being executed in a team comprising of the following members:</p>
              <ul className="list-disc pl-5 text-justify">
                <li><strong>{studentName}</strong> (USN: <strong>{usn}</strong>) - Lead</li>
                {teamMembers.map((tm, idx) => (
                  <li key={idx}>
                    <strong>{tm.name}</strong> (USN: <strong>{tm.usn || 'N/A'}</strong>)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Components Table */}
        <div className="my-6 overflow-x-auto">
          <table className="w-full border-collapse border border-black min-w-[300px]">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black px-2 sm:px-4 py-2 text-left">Sl No.</th>
                <th className="border border-black px-2 sm:px-4 py-2 text-left">Component Name</th>
                <th className="border border-black px-2 sm:px-4 py-2 text-center">Quantity Req.</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td className="border border-black px-2 sm:px-4 py-2 text-center">{idx + 1}</td>
                  <td className="border border-black px-2 sm:px-4 py-2 font-semibold">{item.name}</td>
                  <td className="border border-black px-2 sm:px-4 py-2 text-center">{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Undertaking */}
        <div className="text-justify space-y-3">
          <p>
            I kindly request you to approve the issuance of the aforementioned components for a duration of <strong>{duration} days</strong>. 
            The components are expected to be returned in proper working condition on or before <strong>{displayReturnDate}</strong>.
          </p>
          <p>
            <strong>Undertaking:</strong> I hereby declare that I will bear full responsibility for the components issued to me. 
            In the event of any damage, loss, or delay in returning the components, I agree to pay the standard penalty fees as per department regulations or replace the component.
          </p>
          <p>Thanking you,</p>
        </div>

        {/* Signatures */}
        <div className="flex justify-between items-end mt-12 mb-8">
          <div className="text-left flex gap-8 sm:gap-12">
            <div className="flex flex-col items-center">
              {isApproved ? (
                <div className="h-16 flex items-center justify-center font-serif italic text-2xl text-blue-800">Approved</div>
              ) : (
                <div className="h-16 w-32 border-b border-dashed border-gray-400 mb-2"></div>
              )}
              <p className="font-bold border-t border-gray-400 pt-1 mt-2 inline-block">Faculty Coordinator</p>
            </div>
            <div className="flex flex-col items-center">
              {isApproved ? (
                <div className="h-16 flex items-center justify-center font-serif italic text-2xl text-blue-800">Approved</div>
              ) : (
                <div className="h-16 w-32 border-b border-dashed border-gray-400 mb-2"></div>
              )}
              <p className="font-bold border-t border-gray-400 pt-1 mt-2 inline-block">Lab Admin</p>
            </div>
          </div>
          <div className="text-right flex flex-col items-end">
            {signatureUrl ? (
              <img src={signatureUrl} alt="Student Signature" className="h-16 object-contain mb-2 mix-blend-multiply" />
            ) : (
              <div className="h-16 border-b border-dashed border-gray-400 w-48 mb-2"></div>
            )}
            <p className="font-bold">{studentName}</p>
            <p className="text-xs text-gray-600">({usn})</p>
          </div>
        </div>

        {/* Digital Document Notice */}
        <div className="pt-12 pb-4 text-center">
          <div className="inline-block border-2 border-gray-400 text-gray-500 rounded px-6 py-3 bg-gray-50">
            <p className="font-bold uppercase tracking-widest text-xs mb-1">Digital Preview Document</p>
            <p className="text-xs">This is a system-generated document. No physical submission or manual signatures are required.</p>
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #letter-container, #letter-container * {
            visibility: visible;
          }
          #letter-container {
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
