import React from 'react';
import ReportModal from './ReportModal';
import SEO from './SEO';
import { useNavigate } from 'react-router-dom';

const ReportPage = () => {
  const navigate = useNavigate();

  // We reuse the modal but force it open, and redirect home on close
  return (
    <>
        <SEO 
            title="Report Issue - GoNoGo AI"
            description="Found a bug? Report it here."
            path="/report"
        />
        <ReportModal 
            isOpen={true} 
            onClose={() => navigate("/")} 
            contextData={null} // General report, no context
        />
    </>
  );
};

export default ReportPage;